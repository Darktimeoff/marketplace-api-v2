import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, LessThan } from 'typeorm';
import { OrderWorkflowOutbox, type OrderWorkflowOutboxCreateEntityInterface } from '../entity/order-workflow-outbox.entity.js';

@Injectable()
export class OrderWorkflowOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: OrderWorkflowOutboxCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(OrderWorkflowOutbox).insert(input);
  }

  claimUnstarted(limit: number): Promise<OrderWorkflowOutbox[]> {
    return this.txHost.tx
      .getRepository(OrderWorkflowOutbox)
      .createQueryBuilder('outbox')
      .where('outbox.startedAt IS NULL')
      .orderBy('outbox.createdAt', 'ASC')
      .addOrderBy('outbox.workflowId', 'ASC')
      .limit(limit)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  async markStarted(workflowIds: OrderWorkflowOutbox['workflowId'][]): Promise<void> {
    await this.txHost.tx.getRepository(OrderWorkflowOutbox).update({ workflowId: In(workflowIds) }, { startedAt: () => 'now()' });
  }

  async recordFailure(workflowId: OrderWorkflowOutbox['workflowId'], lastError: string): Promise<void> {
    await this.txHost.tx.getRepository(OrderWorkflowOutbox).update({ workflowId }, { attempts: () => '"attempts" + 1', lastError });
  }

  async deleteStartedBefore(before: Date): Promise<number> {
    const result = await this.txHost.tx.getRepository(OrderWorkflowOutbox).delete({ startedAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
