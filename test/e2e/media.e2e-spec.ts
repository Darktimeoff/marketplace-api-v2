import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { HeadObjectCommand, ListMultipartUploadsCommand, NotFound } from '@aws-sdk/client-s3';
import { MediaStatusEnum } from '@marketplace/contracts-core';
import { AppModule } from '../../src/app.module.js';
import { Media } from '../../src/media/entity/media.entity.js';
import { MediaOutbox } from '../../src/media/entity/media-outbox.entity.js';
import { MediaOrphanCleanupCron } from '../../src/media/cron/media-orphan-cleanup.cron.js';
import { MediaUnattachedCleanupCron } from '../../src/media/cron/media-unattached-cleanup.cron.js';
import { StorageClientService } from '../../src/generic/storage/storage-client.service.js';
import { truncateAllTables } from '../support/isolation.js';

const MIB = 1024 * 1024;

interface UploadInterface {
  id: string;
  status: MediaStatusEnum;
  url: string | null;
  headers: Record<string, string> | null;
  partSize: number | null;
  partCount: number | null;
}

describe('Media (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storage: StorageClientService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    storage = app.get(StorageClientService);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function aToken(): Promise<string> {
    const email = `media-${randomUUID()}@example.com`;
    return (await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'correct-horse' }).expect(201)).body.accessToken;
  }

  function aPng(size = 2048): Buffer {
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(size - 8)]);
  }

  function payload(bytes: Buffer): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  function requestUpload(token: string, body: object, idempotencyKey?: string) {
    const post = request(app.getHttpServer()).post('/media/upload').set('Authorization', `Bearer ${token}`);
    return (idempotencyKey ? post.set('Idempotency-Key', idempotencyKey) : post).send(body);
  }

  function complete(token: string, id: string) {
    return request(app.getHttpServer()).post(`/media/${id}/complete`).set('Authorization', `Bearer ${token}`);
  }

  function parts(token: string, id: string) {
    return request(app.getHttpServer()).get(`/media/${id}/parts`).set('Authorization', `Bearer ${token}`);
  }

  async function aReadyImage(token: string): Promise<UploadInterface> {
    const bytes = aPng();
    const upload: UploadInterface = (await requestUpload(token, { mimeType: 'image/png', sizeBytes: bytes.length }).expect(200)).body;
    expect((await fetch(upload.url!, { method: 'PUT', body: payload(bytes), headers: upload.headers! })).status).toBe(200);
    await complete(token, upload.id).expect(200);
    return upload;
  }

  function storageKeyOf(upload: UploadInterface): Promise<string> {
    return dataSource.getRepository(Media).findOneByOrFail({ publicId: upload.id }).then((media) => media.storageKey);
  }

  async function head(key: string): Promise<{ status: number; size?: number; etag?: string }> {
    try {
      const object = await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }));
      return { status: 200, size: object.ContentLength, etag: object.ETag };
    } catch (error) {
      if (error instanceof NotFound) {
        return { status: 404 };
      }

      throw error;
    }
  }

  it('does not ask for variants of an upload nobody has attached yet', async () => {
    await aReadyImage(await aToken());

    expect(await dataSource.getRepository(MediaOutbox).count()).toBe(0);
  });

  describe('single upload', () => {
    it('signs a PUT for a server-made key and becomes ready only after the bytes arrive', async () => {
      const token = await aToken();
      const bytes = aPng();

      const response = await requestUpload(token, { mimeType: 'image/png', sizeBytes: bytes.length, fileName: '../../etc/passwd' }).expect(200);
      const upload: UploadInterface = response.body;
      const key = await storageKeyOf(upload);

      expect(upload).toMatchObject({ status: MediaStatusEnum.PENDING, partSize: null, partCount: null });
      expect(key).toMatch(/^media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
      expect(new URL(upload.url!).searchParams.get('X-Amz-SignedHeaders')).toBe('cache-control;content-length;content-type;host');

      expect((await complete(token, upload.id).expect(409)).body.message).toBe('Upload has not reached the storage');

      expect((await fetch(upload.url!, { method: 'PUT', body: payload(bytes), headers: upload.headers! })).status).toBe(200);
      expect((await complete(token, upload.id).expect(200)).body).toMatchObject({ id: upload.id, status: MediaStatusEnum.READY, sizeBytes: bytes.length });
      await complete(token, upload.id).expect(200);
    });

    it('refuses a PUT that changes the signed content type', async () => {
      const token = await aToken();
      const bytes = aPng();
      const upload: UploadInterface = (await requestUpload(token, { mimeType: 'image/png', sizeBytes: bytes.length }).expect(200)).body;

      const put = await fetch(upload.url!, { method: 'PUT', body: payload(bytes), headers: { ...upload.headers!, 'content-type': 'text/html' } });

      expect(put.status).toBe(403);
    });

    it('returns the same upload for a repeated Idempotency-Key and refuses the key for another upload', async () => {
      const token = await aToken();
      const key = randomUUID();

      const first: UploadInterface = (await requestUpload(token, { mimeType: 'image/jpeg', sizeBytes: 1000 }, key).expect(200)).body;
      const second: UploadInterface = (await requestUpload(token, { mimeType: 'image/jpeg', sizeBytes: 1000 }, key).expect(200)).body;
      await requestUpload(token, { mimeType: 'image/jpeg', sizeBytes: 2000 }, key).expect(409);

      expect(second.id).toBe(first.id);
      expect(await dataSource.getRepository(Media).count()).toBe(1);
    });

    it('rejects types outside the allowlist, oversized images and anonymous callers', async () => {
      const token = await aToken();

      await requestUpload(token, { mimeType: 'application/x-msdownload', sizeBytes: 10 }).expect(400);
      await requestUpload(token, { mimeType: 'image/png', sizeBytes: 21 * MIB }).expect(400);
      await request(app.getHttpServer()).post('/media/upload').send({ mimeType: 'image/png', sizeBytes: 10 }).expect(401);
    });

    it('hides the upload of another user', async () => {
      const upload: UploadInterface = (await requestUpload(await aToken(), { mimeType: 'image/png', sizeBytes: 10 }).expect(200)).body;

      await complete(await aToken(), upload.id).expect(404);
    });
  });

  describe('multipart upload', () => {
    it('resumes from ListParts and assembles the object only on complete', async () => {
      const token = await aToken();
      const bytes = randomBytes(11 * MIB);

      const upload: UploadInterface = (await requestUpload(token, { mimeType: 'video/mp4', sizeBytes: bytes.length }).expect(200)).body;
      expect(upload).toMatchObject({ url: null, headers: null, partSize: 5 * MIB, partCount: 3 });

      const firstBatch = (await parts(token, upload.id).expect(200)).body;
      expect(firstBatch).toMatchObject({ uploadedPartCount: 0, partCount: 3 });
      for (const { partNumber, url } of firstBatch.parts.slice(0, 2)) {
        expect((await fetch(url, { method: 'PUT', body: payload(bytes.subarray((partNumber - 1) * 5 * MIB, partNumber * 5 * MIB)) })).status).toBe(200);
      }

      expect((await complete(token, upload.id).expect(409)).body.message).toBe('2 of 3 parts are uploaded');
      const key = await storageKeyOf(upload);
      expect((await head(key)).status).toBe(404);

      const resumed = (await parts(token, upload.id).expect(200)).body;
      expect(resumed.uploadedPartCount).toBe(2);
      expect(resumed.parts.map(({ partNumber }: { partNumber: number }) => partNumber)).toEqual([3]);
      expect((await fetch(resumed.parts[0].url, { method: 'PUT', body: payload(bytes.subarray(10 * MIB)) })).status).toBe(200);

      await complete(token, upload.id).expect(200);
      const stored = await head(key);
      expect(stored.size).toBe(bytes.length);
      expect(stored.etag).toMatch(/-3"$/);
    });

    it('signs a part only for its exact length', async () => {
      const token = await aToken();
      const upload: UploadInterface = (await requestUpload(token, { mimeType: 'video/mp4', sizeBytes: 11 * MIB }).expect(200)).body;
      const [first] = (await parts(token, upload.id).expect(200)).body.parts;

      expect((await fetch(first.url, { method: 'PUT', body: payload(randomBytes(MIB)) })).status).toBe(403);
    });
  });

  describe('download', () => {
    it('redirects the owner to a short-lived URL that is never cached', async () => {
      const token = await aToken();
      const upload = await aReadyImage(token);

      const response = await request(app.getHttpServer()).get(`/media/${upload.id}`).set('Authorization', `Bearer ${token}`).expect(302);

      expect(response.headers['cache-control']).toBe('no-store');
      expect(new URL(response.headers.location).searchParams.get('X-Amz-Expires')).toBe('60');
      const file = await fetch(response.headers.location);
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('image/png');
    });

    it('forbids other users and hides media that is not ready', async () => {
      const token = await aToken();
      const ready = await aReadyImage(token);
      const pending: UploadInterface = (await requestUpload(token, { mimeType: 'image/png', sizeBytes: 10 }).expect(200)).body;

      await request(app.getHttpServer()).get(`/media/${ready.id}`).set('Authorization', `Bearer ${await aToken()}`).expect(403);
      await request(app.getHttpServer()).get(`/media/${pending.id}`).set('Authorization', `Bearer ${token}`).expect(404);
    });
  });

  it('deletes uploads pending for more than a day, including their unfinished parts', async () => {
    const token = await aToken();
    const abandonedImage: UploadInterface = (await requestUpload(token, { mimeType: 'image/png', sizeBytes: 10 }).expect(200)).body;
    const abandonedVideo: UploadInterface = (await requestUpload(token, { mimeType: 'video/mp4', sizeBytes: 11 * MIB }).expect(200)).body;
    const [part] = (await parts(token, abandonedVideo.id).expect(200)).body.parts;
    await fetch(part.url, { method: 'PUT', body: payload(randomBytes(5 * MIB)) });
    const fresh: UploadInterface = (await requestUpload(token, { mimeType: 'image/png', sizeBytes: 10 }).expect(200)).body;
    const videoKey = await storageKeyOf(abandonedVideo);
    await dataSource.query(`UPDATE "Media" SET "createdAt" = now() - interval '25 hours' WHERE "publicId" = ANY($1)`, [[abandonedImage.id, abandonedVideo.id]]);

    await app.get(MediaOrphanCleanupCron).deleteOrphans();

    const remaining = await dataSource.getRepository(Media).find();
    expect(remaining.map(({ publicId }) => publicId)).toEqual([fresh.id]);
    const unfinished = await storage.client.send(new ListMultipartUploadsCommand({ Bucket: storage.bucket, Prefix: videoKey }));
    expect(unfinished.Uploads ?? []).toEqual([]);
  });

  it('deletes ready media nobody attached for more than a day, with its object, and keeps claimed and fresh ones', async () => {
    const token = await aToken();
    const unused = await aReadyImage(token);
    const claimed = await aReadyImage(token);
    const fresh = await aReadyImage(token);
    const unusedKey = await storageKeyOf(unused);
    await dataSource.query(`UPDATE "Media" SET "attachedToType" = 'product', "attachedToId" = $2, "attachedAt" = now() WHERE "publicId" = $1`, [claimed.id, randomUUID()]);
    await dataSource.query(`UPDATE "Media" SET "createdAt" = now() - interval '25 hours' WHERE "publicId" = ANY($1)`, [[unused.id, claimed.id]]);

    await app.get(MediaUnattachedCleanupCron).deleteUnattached();

    const remaining = await dataSource.getRepository(Media).find({ withDeleted: true, order: { id: 'ASC' } });
    expect(remaining.map(({ publicId }) => publicId)).toEqual([claimed.id, fresh.id]);
    expect((await head(unusedKey)).status).toBe(404);
    expect((await head(await storageKeyOf(claimed))).status).toBe(200);
  });
});
