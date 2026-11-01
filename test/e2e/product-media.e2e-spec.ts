import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, IsNull } from 'typeorm';
import { execFileSync } from 'node:child_process';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { thumbHashToApproximateAspectRatio } from 'thumbhash';
import { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { LanguageEnum, MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { ProductCreatedEvent } from '@marketplace/messaging-contracts';
import { Media } from '../../src/media/entity/media.entity.js';
import { MediaOutbox } from '../../src/media/entity/media-outbox.entity.js';
import { MediaVariant } from '../../src/media/entity/media-variant.entity.js';
import type { MediaVariantsGenerateCommandHandler } from '../../src/media/command-handler/media-variants-generate.command-handler.js';
import type { StorageClientService } from '../../src/generic/storage/storage-client.service.js';
import { ProductMedia } from '../../src/product/entity/product-media.entity.js';
import { ProductOutbox } from '../../src/product/entity/product-outbox.entity.js';
import { MediaClaimReleaseCron } from '../../src/media/cron/media-claim-release.cron.js';
import { MediaClaimCommandHandler } from '../../src/media/command-handler/media-claim.command-handler.js';
import { RoleEnum } from '../../src/identity/enum/role.enum.js';
import { aBrandWithTranslation, aCategoryWithTranslation } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

process.env.KAFKA_CONSUMERS_ENABLED = 'true';

describe('Product media (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storage: StorageClientService;
  let generate: MediaVariantsGenerateCommandHandler;

  beforeAll(async () => {
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    storage = app.get((await import('../../src/generic/storage/storage-client.service.js')).StorageClientService);
    generate = app.get((await import('../../src/media/command-handler/media-variants-generate.command-handler.js')).MediaVariantsGenerateCommandHandler);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function aSeller(): Promise<string> {
    const email = `seller-${randomUUID()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'correct-horse' }).expect(201);
    await dataSource.query(`UPDATE "Identity" SET "role" = $1 WHERE "email" = $2`, [RoleEnum.seller, email]);
    return (await request(app.getHttpServer()).post('/auth/login').send({ login: email, password: 'correct-horse' }).expect(200)).body.accessToken;
  }

  async function anImage(token: string, ready = true): Promise<string> {
    return anUpload(token, await sharp({ create: { width: 1000, height: 600, channels: 3, background: { r: 200, g: 60, b: 40 } } }).png().toBuffer(), 'image/png', ready);
  }

  async function anUpload(token: string, bytes: Buffer, mimeType: string, ready = true): Promise<string> {
    const upload = (await request(app.getHttpServer()).post('/media/upload').set('Authorization', `Bearer ${token}`).send({ mimeType, sizeBytes: bytes.length }).expect(200)).body;

    if (ready) {
      await fetch(upload.url, { method: 'PUT', body: new Uint8Array(bytes), headers: upload.headers });
      await request(app.getHttpServer()).post(`/media/${upload.id}/complete`).set('Authorization', `Bearer ${token}`).expect(200);
    }

    return upload.id;
  }

  async function aBody(mediaIds: string[], categoryPublicId?: string) {
    const suffix = randomUUID();
    const category = await aCategoryWithTranslation(dataSource.manager, { slug: `kitchen-${suffix}`, name: 'Kitchen' });
    const brand = await aBrandWithTranslation(dataSource.manager, { slug: `acme-${suffix}`, name: 'Acme' });
    return { categoryPublicId: categoryPublicId ?? category.publicId, brandPublicId: brand.publicId, translations: [{ language: LanguageEnum.en, title: 'Kettle' }], mediaIds };
  }

  function create(token: string, body: object) {
    return request(app.getHttpServer()).post('/product').set('Authorization', `Bearer ${token}`).send(body);
  }

  function mediaRow(publicId: string): Promise<Media> {
    return dataSource.getRepository(Media).findOneByOrFail({ publicId });
  }

  async function deadLettered(mediaPublicId: string): Promise<boolean> {
    const channel = app.get(AmqpConnection).channel;

    for (let message = await channel.get('media.variants.dlq', { noAck: true }); message; message = await channel.get('media.variants.dlq', { noAck: true })) {
      if (JSON.parse(message.content.toString())?.data?.mediaPublicId === mediaPublicId) {
        return true;
      }
    }

    return false;
  }

  function variantsOf(mediaPublicId: string): Promise<MediaVariant[]> {
    return dataSource.getRepository(MediaVariant).find({ where: { media: { publicId: mediaPublicId } }, order: { name: 'ASC' } });
  }

  async function contentTypeOf(storageKey: string): Promise<string | undefined> {
    return (await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: storageKey }))).ContentType;
  }

  it('attaches the media in order, answers CDN URLs and confirms the claim through product.created', async () => {
    const token = await aSeller();
    const ids = [await anImage(token), await anImage(token)];

    const response = await create(token, await aBody(ids)).expect(201);

    const product = response.body;
    expect(product.media.map(({ thumbHash, variants }: { thumbHash: string | null; variants: unknown[] }) => ({ thumbHash, variants }))).toEqual([
      { thumbHash: null, variants: [] },
      { thumbHash: null, variants: [] },
    ]);
    expect(product.media.map(({ id, position }: { id: string; position: number }) => ({ id, position }))).toEqual([
      { id: ids[0], position: 0 },
      { id: ids[1], position: 1 },
    ]);
    for (const [index, item] of product.media.entries()) {
      expect(item.url).toBe(`http://localhost:8088/${(await mediaRow(ids[index])).storageKey}`);
    }
    expect(await dataSource.getRepository(ProductMedia).count()).toBe(2);
    expect(await dataSource.getRepository(ProductOutbox).findOneByOrFail({ id: product.publicId })).toMatchObject({
      type: ProductCreatedEvent.TYPE,
      payload: { productPublicId: product.publicId, mediaIds: ids },
    });

    await vi.waitFor(
      async () => {
        for (const id of ids) {
          expect(await mediaRow(id)).toMatchObject({ attachedToType: MediaAttachmentTypeEnum.PRODUCT, attachedToId: product.publicId, claimExpiresAt: null });
        }
      },
      { timeout: 20000, interval: 100 },
    );
    await vi.waitFor(
      async () => {
        for (const id of ids) {
          expect((await variantsOf(id)).map(({ name }) => name)).toEqual([MediaVariantNameEnum.W320, MediaVariantNameEnum.W800]);
        }
      },
      { timeout: 30000, interval: 200 },
    );
    expect(await dataSource.getRepository(MediaOutbox).findBy({ publishedAt: IsNull() })).toEqual([]);
    const [small, medium] = await variantsOf(ids[0]);
    const original = await mediaRow(ids[0]);
    expect(small).toMatchObject({ mimeType: 'image/webp', width: 320, height: 192, storageKey: original.storageKey.replace(/\.png$/, '/w320.webp') });
    expect(medium).toMatchObject({ width: 800, height: 480 });
    expect(await contentTypeOf(small.storageKey)).toBe('image/webp');
    expect(thumbHashToApproximateAspectRatio(Buffer.from(original.thumbHash!, 'base64'))).toBeCloseTo(1000 / 600, 0);

    const read = await vi.waitFor(
      async () => {
        const body = (await request(app.getHttpServer()).get(`/product/${product.publicId}`).expect(200)).body;
        expect(body.media.map((item: { variants: { name: string }[] }) => item.variants.map(({ name }) => name))).toEqual([
          [MediaVariantNameEnum.W320, MediaVariantNameEnum.W800],
          [MediaVariantNameEnum.W320, MediaVariantNameEnum.W800],
        ]);
        return body;
      },
      { timeout: 30000, interval: 200 },
    );
    expect(read.media[0]).toMatchObject({
      id: ids[0],
      position: 0,
      thumbHash: original.thumbHash,
      variants: [
        { name: MediaVariantNameEnum.W320, mimeType: 'image/webp', url: `http://localhost:8088/${small.storageKey}`, width: 320, height: 192 },
        { name: MediaVariantNameEnum.W800, mimeType: 'image/webp', url: `http://localhost:8088/${medium.storageKey}`, width: 800, height: 480 },
      ],
    });
    await request(app.getHttpServer()).get(`/product/${randomUUID()}`).expect(404);
  });

  it('refuses media of another seller, media attached elsewhere and media without bytes', async () => {
    const token = await aSeller();
    const foreign = await anImage(await aSeller());
    const pending = await anImage(token, false);
    const attached = await anImage(token);
    await create(token, await aBody([attached])).expect(201);

    for (const id of [foreign, pending, attached]) {
      expect((await create(token, await aBody([id])).expect(409)).body.message).toBe(`Media not available: ${id}`);
    }
  });

  it('claims all or nothing and creates no product when one id is refused', async () => {
    const token = await aSeller();
    const mine = await anImage(token);
    const foreign = await anImage(await aSeller());

    await create(token, await aBody([mine, foreign])).expect(409);

    expect(await mediaRow(mine)).toMatchObject({ attachedToId: null, claimExpiresAt: null });
    expect(await dataSource.getRepository(ProductMedia).count()).toBe(0);
  });

  it('checks the category and brand before claiming, so a 404 leaves the media free', async () => {
    const token = await aSeller();
    const photo = await anImage(token);

    await create(token, await aBody([photo], '00000000-0000-4000-8000-000000000001')).expect(404);

    expect(await mediaRow(photo)).toMatchObject({ attachedToId: null, claimExpiresAt: null });
  });

  it('releases a claim whose product never committed so the media can be used again', async () => {
    const token = await aSeller();
    const photo = await anImage(token);
    const owner = (await mediaRow(photo)).ownerPublicId;
    await app.get(MediaClaimCommandHandler).execute({ ownerPublicId: owner, mediaIds: [photo], attachTo: { type: MediaAttachmentTypeEnum.PRODUCT, id: randomUUID() } });
    expect((await mediaRow(photo)).claimExpiresAt).not.toBeNull();

    await dataSource.query(`UPDATE "Media" SET "claimExpiresAt" = now() - interval '1 second' WHERE "publicId" = $1`, [photo]);
    await app.get(MediaClaimReleaseCron).releaseExpired();

    expect(await mediaRow(photo)).toMatchObject({ attachedToId: null, claimExpiresAt: null });
    await create(token, await aBody([photo])).expect(201);
  });

  it('dead-letters a file that is not an image at once, without variants', async () => {
    const token = await aSeller();
    const junk = await anUpload(token, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(1000)]), 'image/png');

    await create(token, await aBody([junk])).expect(201);

    await vi.waitFor(
      async () => {
        expect(await deadLettered(junk)).toBe(true);
      },
      { timeout: 30000, interval: 200 },
    );
    expect(await variantsOf(junk)).toEqual([]);
    expect((await mediaRow(junk)).thumbHash).toBeNull();
  });

  it('dead-letters a message that is not a variants job', async () => {
    const mediaPublicId = randomUUID();
    await app.get(AmqpConnection).publish('', 'media.variants', { specversion: '1.0', id: 'not-a-uuid', type: 'media.variants.generate', data: { mediaPublicId } });

    await vi.waitFor(
      async () => {
        expect(await deadLettered(mediaPublicId)).toBe(true);
      },
      { timeout: 10000, interval: 100 },
    );
  });

  it('turns a video into a webm and a poster, and does the work once when the job is delivered again', async () => {
    const token = await aSeller();
    const video = execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1',
    ]);
    const id = await anUpload(token, video, 'video/mp4');

    await generate.execute(id);
    const first = await variantsOf(id);
    await generate.execute(id);

    expect(first.map(({ name, mimeType, width, height }) => ({ name, mimeType, width, height }))).toEqual([
      { name: MediaVariantNameEnum.VIDEO_720, mimeType: 'video/webm', width: 640, height: 360 },
      { name: MediaVariantNameEnum.POSTER, mimeType: 'image/webp', width: 640, height: 360 },
    ]);
    expect((await variantsOf(id)).map(({ id: variantId }) => variantId)).toEqual(first.map(({ id: variantId }) => variantId));
    expect(await contentTypeOf(first[0].storageKey)).toBe('video/webm');
    expect((await mediaRow(id)).thumbHash).not.toBeNull();
  }, 60_000);
});
