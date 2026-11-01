import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { MediaStatusEnum, type MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { Media, type MediaCreateEntityInterface } from '../entity/media.entity.js';

@Injectable()
export class MediaRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: MediaCreateEntityInterface): Promise<Media> {
    const media = this.txHost.tx.getRepository(Media);
    return media.save(media.create(input));
  }

  async lockIdempotencyKey(ownerPublicId: Media['ownerPublicId'], idempotencyKey: string): Promise<void> {
    await this.txHost.tx.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`media:${ownerPublicId}:${idempotencyKey}`]);
  }

  findByIdempotencyKey(ownerPublicId: Media['ownerPublicId'], idempotencyKey: string): Promise<Media | null> {
    return this.txHost.tx.getRepository(Media).findOneBy({ ownerPublicId, idempotencyKey });
  }

  findByPublicId(publicId: Media['publicId']): Promise<Media | null> {
    return this.txHost.tx.getRepository(Media).findOneBy({ publicId });
  }

  findPendingCreatedBefore(createdBefore: Date, limit: number): Promise<Media[]> {
    return this.txHost.tx.getRepository(Media).find({
      where: { status: MediaStatusEnum.PENDING, createdAt: LessThan(createdBefore) },
      order: { id: 'ASC' },
      take: limit,
    });
  }

  async deleteById(id: Media['id']): Promise<void> {
    await this.txHost.tx.getRepository(Media).delete({ id });
  }

  async claim(
    publicIds: Media['publicId'][],
    ownerPublicId: Media['ownerPublicId'],
    attachedToType: MediaAttachmentTypeEnum,
    attachedToId: string,
    claimTtlSeconds: number,
  ): Promise<Media[]> {
    const [rows] = await this.txHost.tx.query(
      `UPDATE "Media"
          SET "attachedToType" = $3,
              "attachedToId" = $4,
              "attachedAt" = COALESCE("attachedAt", now()),
              "claimExpiresAt" = CASE WHEN "attachedToId" IS NULL THEN now() + make_interval(secs => $5) ELSE "claimExpiresAt" END
        WHERE "publicId" = ANY($1::uuid[])
          AND "ownerPublicId" = $2
          AND "status" = $6
          AND "deletedAt" IS NULL
          AND ("attachedToId" IS NULL OR ("attachedToType" = $3 AND "attachedToId" = $4))
    RETURNING "id"`,
      [publicIds, ownerPublicId, attachedToType, attachedToId, claimTtlSeconds, MediaStatusEnum.READY],
    );
    const ids = (rows as { id: number }[]).map((row) => row.id);

    return ids.length > 0 ? this.txHost.tx.getRepository(Media).findBy({ id: In(ids) }) : [];
  }

  async confirmClaim(publicIds: Media['publicId'][], attachedToType: MediaAttachmentTypeEnum, attachedToId: string): Promise<number> {
    const [, affected] = await this.txHost.tx.query(
      `UPDATE "Media"
          SET "attachedToType" = $2,
              "attachedToId" = $3,
              "attachedAt" = COALESCE("attachedAt", now()),
              "claimExpiresAt" = NULL
        WHERE "publicId" = ANY($1::uuid[])
          AND "status" = $4
          AND "deletedAt" IS NULL
          AND ("attachedToId" IS NULL OR ("attachedToType" = $2 AND "attachedToId" = $3))`,
      [publicIds, attachedToType, attachedToId, MediaStatusEnum.READY],
    );

    return affected as number;
  }

  async releaseExpiredClaims(): Promise<number> {
    const [, affected] = await this.txHost.tx.query(
      `UPDATE "Media"
          SET "attachedToType" = NULL, "attachedToId" = NULL, "attachedAt" = NULL, "claimExpiresAt" = NULL
        WHERE "claimExpiresAt" < now()`,
    );

    return affected as number;
  }

  findOwned(publicId: Media['publicId'], ownerPublicId: Media['ownerPublicId']): Promise<Media | null> {
    return this.txHost.tx.getRepository(Media).findOneBy({ publicId, ownerPublicId });
  }

  async markPendingReady(id: Media['id']): Promise<Media | null> {
    const result = await this.txHost.tx
      .getRepository(Media)
      .createQueryBuilder()
      .update()
      .set({ status: MediaStatusEnum.READY })
      .where({ id, status: MediaStatusEnum.PENDING })
      .returning(['id'])
      .execute();

    return result.raw.length > 0 ? this.txHost.tx.getRepository(Media).findOneByOrFail({ id }) : null;
  }
}
