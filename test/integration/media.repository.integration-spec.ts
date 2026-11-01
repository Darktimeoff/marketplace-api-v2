import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAttachmentTypeEnum, MediaClaimStatusEnum, MediaKindEnum, MediaStatusEnum } from '@marketplace/contracts-core';
import { Media } from '../../src/media/entity/media.entity.js';
import { MediaRepository } from '../../src/media/repository/media.repository.js';
import { MediaMessage } from '../../src/media/message/media.message.js';
import { MediaClaimCommandHandler } from '../../src/media/command-handler/media-claim.command-handler.js';
import { MediaClaimConfirmCommandHandler } from '../../src/media/command-handler/media-claim-confirm.command-handler.js';
import { MediaOutbox } from '../../src/media/entity/media-outbox.entity.js';
import { MediaOutboxRepository } from '../../src/media/repository/media-outbox.repository.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

@Module({
  imports: [TypeOrmModule.forFeature([Media, MediaOutbox])],
  providers: [MediaRepository, MediaOutboxRepository, MediaMessage, MediaClaimCommandHandler, MediaClaimConfirmCommandHandler],
})
class MediaTestModule {}

const PRODUCT = MediaAttachmentTypeEnum.PRODUCT;

describe('MediaRepository', () => {
  let testModule: TestModule;
  let media: MediaRepository;
  let claimHandler: MediaClaimCommandHandler;
  const owner = randomUUID();

  beforeAll(async () => {
    testModule = await createTestModule([MediaTestModule]);
    media = testModule.app.get(MediaRepository);
    claimHandler = testModule.app.get(MediaClaimCommandHandler);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  async function aMedia(overrides: Partial<Media> = {}): Promise<Media> {
    const created = await media.create({
      ownerPublicId: owner,
      kind: MediaKindEnum.IMAGE,
      storageKey: `media/${owner}/${randomUUID()}.png`,
      mimeType: 'image/png',
      sizeBytes: 1024,
      uploadId: null,
      idempotencyKey: null,
    });
    const status = overrides.status ?? MediaStatusEnum.READY;
    await testModule.dataSource.getRepository(Media).update(created.id, { ...overrides, status });
    return testModule.dataSource.getRepository(Media).findOneByOrFail({ id: created.id });
  }

  function reload(item: Media): Promise<Media> {
    return testModule.dataSource.getRepository(Media).findOneByOrFail({ id: item.id });
  }

  function claim(ids: string[], productId: string, by = owner) {
    return claimHandler.execute({ ownerPublicId: by, mediaIds: ids, attachTo: { type: PRODUCT, id: productId } });
  }

  describe('claim', () => {
    it('attaches ready media of the owner with a ten-minute reservation', async () => {
      const photo = await aMedia();
      const productId = randomUUID();

      const response = await claim([photo.publicId], productId);

      expect(response.status).toBe(MediaClaimStatusEnum.CLAIMED);
      const claimed = await reload(photo);
      expect(claimed).toMatchObject({ attachedToType: PRODUCT, attachedToId: productId });
      expect(claimed.claimExpiresAt!.getTime() - claimed.attachedAt!.getTime()).toBeGreaterThan(9 * 60_000);
    });

    it('rejects media of someone else, pending media and media attached elsewhere', async () => {
      const foreign = await aMedia({ ownerPublicId: randomUUID() });
      const pending = await aMedia({ status: MediaStatusEnum.PENDING });
      const taken = await aMedia({ attachedToType: PRODUCT, attachedToId: randomUUID(), attachedAt: new Date() });

      for (const item of [foreign, pending, taken]) {
        expect(await claim([item.publicId], randomUUID())).toEqual({ status: MediaClaimStatusEnum.REJECTED, rejectedMediaIds: [item.publicId] });
      }
    });

    it('claims all or nothing: one bad id rolls back the good ones', async () => {
      const mine = await aMedia();
      const foreign = await aMedia({ ownerPublicId: randomUUID() });

      const response = await claim([mine.publicId, foreign.publicId], randomUUID());

      expect(response).toEqual({ status: MediaClaimStatusEnum.REJECTED, rejectedMediaIds: [foreign.publicId] });
      expect(await reload(mine)).toMatchObject({ attachedToId: null, claimExpiresAt: null });
    });

    it('is idempotent for the same product and does not turn a confirmed claim back into a reservation', async () => {
      const photo = await aMedia();
      const productId = randomUUID();
      await claim([photo.publicId], productId);
      await media.confirmClaim([photo.publicId], PRODUCT, productId);

      const retried = await claim([photo.publicId], productId);

      expect(retried.status).toBe(MediaClaimStatusEnum.CLAIMED);
      expect(await reload(photo)).toMatchObject({ attachedToId: productId, claimExpiresAt: null });
    });
  });

  describe('confirmClaim', () => {
    it('clears the reservation of the claiming product', async () => {
      const photo = await aMedia();
      const productId = randomUUID();
      await claim([photo.publicId], productId);

      expect(await media.confirmClaim([photo.publicId], PRODUCT, productId)).toEqual([photo.publicId]);
      expect(await reload(photo)).toMatchObject({ attachedToId: productId, claimExpiresAt: null });
    });

    it('reattaches a late confirmation when the expired claim was released and the media is still free', async () => {
      const photo = await aMedia();
      const productId = randomUUID();

      expect(await media.confirmClaim([photo.publicId], PRODUCT, productId)).toEqual([photo.publicId]);
      expect(await reload(photo)).toMatchObject({ attachedToType: PRODUCT, attachedToId: productId, claimExpiresAt: null });
    });

    it('leaves media that another product has taken in the meantime', async () => {
      const otherProduct = randomUUID();
      const photo = await aMedia({ attachedToType: PRODUCT, attachedToId: otherProduct, attachedAt: new Date() });

      expect(await media.confirmClaim([photo.publicId], PRODUCT, randomUUID())).toEqual([]);
      expect(await reload(photo)).toMatchObject({ attachedToId: otherProduct });
    });

    it('asks for variants of confirmed media once, even when product.created is delivered twice', async () => {
      const photo = await aMedia();
      const taken = await aMedia({ attachedToType: PRODUCT, attachedToId: randomUUID(), attachedAt: new Date() });
      const productId = randomUUID();
      await claim([photo.publicId], productId);
      const confirm = testModule.app.get(MediaClaimConfirmCommandHandler);

      await confirm.execute([photo.publicId, taken.publicId], PRODUCT, productId);
      await confirm.execute([photo.publicId, taken.publicId], PRODUCT, productId);

      const rows = await testModule.dataSource.getRepository(MediaOutbox).find();
      expect(rows.map(({ id, payload }) => ({ id, payload }))).toEqual([{ id: photo.publicId, payload: { mediaPublicId: photo.publicId } }]);
    });
  });

  it('releases only claims whose reservation has expired', async () => {
    const expired = await aMedia();
    const fresh = await aMedia();
    await claim([expired.publicId], randomUUID());
    await claim([fresh.publicId], randomUUID());
    await testModule.dataSource.query(`UPDATE "Media" SET "claimExpiresAt" = now() - interval '1 second' WHERE "id" = $1`, [expired.id]);

    expect(await media.releaseExpiredClaims()).toBe(1);

    expect(await reload(expired)).toMatchObject({ attachedToType: null, attachedToId: null, attachedAt: null, claimExpiresAt: null });
    expect((await reload(fresh)).attachedToId).not.toBeNull();
  });

  it('finds pending media older than the cutoff, oldest first, and never ready ones', async () => {
    const old = await aMedia({ status: MediaStatusEnum.PENDING });
    const older = await aMedia({ status: MediaStatusEnum.PENDING });
    await aMedia({ status: MediaStatusEnum.PENDING });
    const readyOld = await aMedia();
    await testModule.dataSource.query(`UPDATE "Media" SET "createdAt" = now() - interval '2 days' WHERE "id" = ANY($1)`, [[old.id, older.id, readyOld.id]]);

    const found = await media.findPendingCreatedBefore(new Date(Date.now() - 24 * 3_600_000), 10);

    expect(found.map((item) => item.id)).toEqual([old.id, older.id]);
  });

  describe('unattached cleanup', () => {
    it('finds ready media never attached before the cutoff, and rows already marked deleted', async () => {
      const unattached = await aMedia();
      const marked = await aMedia();
      const reserved = await aMedia();
      const attached = await aMedia({ attachedToType: PRODUCT, attachedToId: randomUUID(), attachedAt: new Date() });
      const pending = await aMedia({ status: MediaStatusEnum.PENDING });
      await aMedia();
      await claim([reserved.publicId], randomUUID());
      await testModule.dataSource.query(`UPDATE "Media" SET "createdAt" = now() - interval '2 days' WHERE "id" = ANY($1)`, [[unattached.id, reserved.id, attached.id, pending.id]]);
      await testModule.dataSource.query(`UPDATE "Media" SET "deletedAt" = now() WHERE "id" = $1`, [marked.id]);

      const found = await media.findUnattachedReadyCreatedBefore(new Date(Date.now() - 24 * 3_600_000), 10);

      expect(found.map((item) => item.id)).toEqual([unattached.id, marked.id]);
    });

    it('marks only unattached media, and a marked one can no longer be claimed', async () => {
      const unattached = await aMedia();
      const claimed = await aMedia();
      await claim([claimed.publicId], randomUUID());

      expect(await media.markDeletedIfUnattached(claimed.id)).toBe(false);
      expect(await media.markDeletedIfUnattached(unattached.id)).toBe(true);
      expect(await media.markDeletedIfUnattached(unattached.id)).toBe(true);

      expect((await claim([unattached.publicId], randomUUID())).status).toBe(MediaClaimStatusEnum.REJECTED);
      expect((await reload(claimed)).deletedAt).toBeNull();
    });
  });
});
