import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { IdentityOutbox, type IdentityOutboxCreateEntityInterface } from '../entity/identity-outbox.entity.js';

@Injectable()
export class IdentityOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: IdentityOutboxCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(IdentityOutbox).insert(input);
  }

  claimUnpublished(limit: number): Promise<IdentityOutbox[]> {
    return this.txHost.tx
      .getRepository(IdentityOutbox)
      .createQueryBuilder('outbox')
      .where('outbox.publishedAt IS NULL')
      .orderBy('outbox.createdAt', 'ASC')
      .addOrderBy('outbox.id', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markPublished(ids: IdentityOutbox['id'][]): Promise<void> {
    await this.txHost.tx.getRepository(IdentityOutbox).update({ id: In(ids) }, { publishedAt: () => 'now()' });
  }

  async recordFailure(id: IdentityOutbox['id'], lastError: string): Promise<void> {
    await this.txHost.tx.getRepository(IdentityOutbox).update({ id }, { attempts: () => '"attempts" + 1', lastError });
  }

  async deletePublishedBefore(before: Date): Promise<number> {
    const result = await this.txHost.tx.getRepository(IdentityOutbox).delete({ publishedAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
