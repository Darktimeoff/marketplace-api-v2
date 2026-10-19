import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { UserOutbox, type UserOutboxCreateEntityInterface } from '../entity/user-outbox.entity.js';

@Injectable()
export class UserOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: UserOutboxCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(UserOutbox).insert(input);
  }

  claimUnpublished(limit: number): Promise<UserOutbox[]> {
    return this.txHost.tx
      .getRepository(UserOutbox)
      .createQueryBuilder('outbox')
      .where('outbox.publishedAt IS NULL')
      .orderBy('outbox.createdAt', 'ASC')
      .addOrderBy('outbox.id', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markPublished(ids: UserOutbox['id'][]): Promise<void> {
    await this.txHost.tx.getRepository(UserOutbox).update({ id: In(ids) }, { publishedAt: () => 'now()' });
  }

  async recordFailure(id: UserOutbox['id'], lastError: string): Promise<void> {
    await this.txHost.tx.getRepository(UserOutbox).update({ id }, { attempts: () => '"attempts" + 1', lastError });
  }

  async deletePublishedBefore(before: Date): Promise<number> {
    const result = await this.txHost.tx.getRepository(UserOutbox).delete({ publishedAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
