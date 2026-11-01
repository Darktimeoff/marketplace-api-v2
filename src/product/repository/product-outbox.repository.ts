import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { ProductOutbox, type ProductOutboxCreateEntityInterface } from '../entity/product-outbox.entity.js';

@Injectable()
export class ProductOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: ProductOutboxCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(ProductOutbox).insert(input);
  }

  claimUnpublished(limit: number): Promise<ProductOutbox[]> {
    return this.txHost.tx
      .getRepository(ProductOutbox)
      .createQueryBuilder('outbox')
      .where('outbox.publishedAt IS NULL')
      .orderBy('outbox.createdAt', 'ASC')
      .addOrderBy('outbox.id', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markPublished(ids: ProductOutbox['id'][]): Promise<void> {
    await this.txHost.tx.getRepository(ProductOutbox).update({ id: In(ids) }, { publishedAt: () => 'now()' });
  }

  async recordFailure(id: ProductOutbox['id'], lastError: string): Promise<void> {
    await this.txHost.tx.getRepository(ProductOutbox).update({ id }, { attempts: () => '"attempts" + 1', lastError });
  }

  async deletePublishedBefore(before: Date): Promise<number> {
    const result = await this.txHost.tx.getRepository(ProductOutbox).delete({ publishedAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
