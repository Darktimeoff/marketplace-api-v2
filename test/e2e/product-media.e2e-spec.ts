import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { LanguageEnum, MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { ProductCreatedEvent } from '@marketplace/messaging-contracts';
import { Media } from '../../src/media/entity/media.entity.js';
import { ProductMedia } from '../../src/product/entity/product-media.entity.js';
import { ProductOutbox } from '../../src/product/entity/product-outbox.entity.js';
import { MediaClaimReleaseService } from '../../src/media/service/media-claim-release.service.js';
import { RoleEnum } from '../../src/identity/enum/role.enum.js';
import { aBrandWithTranslation, aCategoryWithTranslation } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

process.env.KAFKA_CONSUMERS_ENABLED = 'true';

describe('Product media (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
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
    const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(1000)]);
    const upload = (await request(app.getHttpServer()).post('/media/upload').set('Authorization', `Bearer ${token}`).send({ mimeType: 'image/png', sizeBytes: bytes.length }).expect(200)).body;

    if (ready) {
      await fetch(upload.url, { method: 'PUT', body: new Uint8Array(bytes), headers: upload.headers });
      await request(app.getHttpServer()).post(`/media/${upload.id}/complete`).set('Authorization', `Bearer ${token}`).expect(200);
    }

    return upload.id;
  }

  async function aBody(mediaIds: string[], categoryId?: number) {
    const suffix = randomUUID();
    const category = await aCategoryWithTranslation(dataSource.manager, { slug: `kitchen-${suffix}`, name: 'Kitchen' });
    const brand = await aBrandWithTranslation(dataSource.manager, { slug: `acme-${suffix}`, name: 'Acme' });
    return { categoryId: categoryId ?? category.id, brandId: brand.id, translations: [{ language: LanguageEnum.en, title: 'Kettle' }], mediaIds };
  }

  function create(token: string, body: object) {
    return request(app.getHttpServer()).post('/product').set('Authorization', `Bearer ${token}`).send(body);
  }

  function mediaRow(publicId: string): Promise<Media> {
    return dataSource.getRepository(Media).findOneByOrFail({ publicId });
  }

  it('attaches the media in order, answers CDN URLs and confirms the claim through product.created', async () => {
    const token = await aSeller();
    const ids = [await anImage(token), await anImage(token)];

    const response = await create(token, await aBody(ids)).expect(201);

    const product = response.body;
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

  it('releases the claim of a product that never committed so the media can be used again', async () => {
    const token = await aSeller();
    const photo = await anImage(token);

    await create(token, await aBody([photo], 999999)).expect(404);
    const reserved = await mediaRow(photo);
    expect(reserved.attachedToId).not.toBeNull();
    expect(reserved.claimExpiresAt).not.toBeNull();

    await dataSource.query(`UPDATE "Media" SET "claimExpiresAt" = now() - interval '1 second' WHERE "publicId" = $1`, [photo]);
    await app.get(MediaClaimReleaseService).releaseExpired();

    expect(await mediaRow(photo)).toMatchObject({ attachedToId: null, claimExpiresAt: null });
    await create(token, await aBody([photo])).expect(201);
  });
});
