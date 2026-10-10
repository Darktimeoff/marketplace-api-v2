import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { OrderOutbox, type OrderOutboxCreateEntityInterface } from '../entity/order-outbox.entity.js';

@Injectable()
export class OrderOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: OrderOutboxCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(OrderOutbox).insert(input);
  }

  claimUnpublished(limit: number): Promise<OrderOutbox[]> {
    return this.txHost.tx
      .getRepository(OrderOutbox)
      .createQueryBuilder('outbox')
      .where('outbox.publishedAt IS NULL')
      .orderBy('outbox.createdAt', 'ASC')
      .addOrderBy('outbox.id', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markPublished(ids: OrderOutbox['id'][]): Promise<void> {
    await this.txHost.tx.getRepository(OrderOutbox).update({ id: In(ids) }, { publishedAt: () => 'now()' });
  }

  async recordFailure(id: OrderOutbox['id'], lastError: string): Promise<void> {
    await this.txHost.tx.getRepository(OrderOutbox).update({ id }, { attempts: () => '"attempts" + 1', lastError });
  }

  async deletePublishedBefore(before: Date): Promise<number> {
    const result = await this.txHost.tx.getRepository(OrderOutbox).delete({ publishedAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
