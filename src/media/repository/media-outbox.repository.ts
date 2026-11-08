import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { MediaOutbox, type MediaOutboxCreateEntityInterface } from '../entity/media-outbox.entity.js';

@Injectable()
export class MediaOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: MediaOutboxCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(MediaOutbox).insert(input);
  }

  async createManyIgnoringExisting(input: MediaOutboxCreateEntityInterface[]): Promise<void> {
    await this.txHost.tx.getRepository(MediaOutbox).createQueryBuilder().insert().values(input).orIgnore().execute();
  }

  claimUnpublished(limit: number): Promise<MediaOutbox[]> {
    return this.txHost.tx
      .getRepository(MediaOutbox)
      .createQueryBuilder('outbox')
      .where('outbox.publishedAt IS NULL')
      .orderBy('outbox.createdAt', 'ASC')
      .addOrderBy('outbox.id', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markPublished(ids: MediaOutbox['id'][]): Promise<void> {
    await this.txHost.tx.getRepository(MediaOutbox).update({ id: In(ids) }, { publishedAt: () => 'now()' });
  }

  async recordFailure(id: MediaOutbox['id'], lastError: string): Promise<void> {
    await this.txHost.tx.getRepository(MediaOutbox).update({ id }, { attempts: () => '"attempts" + 1', lastError });
  }

  async deletePublishedBefore(before: Date): Promise<number> {
    const result = await this.txHost.tx.getRepository(MediaOutbox).delete({ publishedAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
