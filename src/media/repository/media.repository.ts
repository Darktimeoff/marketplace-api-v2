import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { LessThan } from 'typeorm';
import { MediaStatusEnum } from '@marketplace/contracts-core';
import { Media, type MediaCreateEntityInterface } from '../entity/media.entity.js';

@Injectable()
export class MediaRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: MediaCreateEntityInterface): Promise<Media> {
    const media = this.txHost.tx.getRepository(Media);
    return media.save(media.create(input));
  }

  async lockIdempotencyKey(ownerIdentityPublicId: Media['ownerIdentityPublicId'], idempotencyKey: string): Promise<void> {
    await this.txHost.tx.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`media:${ownerIdentityPublicId}:${idempotencyKey}`]);
  }

  findByIdempotencyKey(ownerIdentityPublicId: Media['ownerIdentityPublicId'], idempotencyKey: string): Promise<Media | null> {
    return this.txHost.tx.getRepository(Media).findOneBy({ ownerIdentityPublicId, idempotencyKey });
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

  findOwned(publicId: Media['publicId'], ownerIdentityPublicId: Media['ownerIdentityPublicId']): Promise<Media | null> {
    return this.txHost.tx.getRepository(Media).findOneBy({ publicId, ownerIdentityPublicId });
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
