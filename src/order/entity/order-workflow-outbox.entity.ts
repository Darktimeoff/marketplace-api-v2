import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { OrderTaskQueueEnum } from '../enum/order-task-queue.enum.js';

@Entity('OrderWorkflowOutbox')
@Index('OrderWorkflowOutbox_unstarted_idx', ['createdAt'], { where: '"startedAt" IS NULL' })
@Check('OrderWorkflowOutbox_attempts_nonneg', `"attempts" >= 0`)
@Check('OrderWorkflowOutbox_startedAt_order', `"startedAt" IS NULL OR "startedAt" >= "createdAt"`)
export class OrderWorkflowOutbox {
  @PrimaryColumn({ type: 'varchar', length: 255, primaryKeyConstraintName: 'OrderWorkflowOutbox_pkey' })
  workflowId: string;

  @Column({ type: 'varchar', length: 128 })
  workflowType: string;

  @Column({ type: 'varchar', length: 128 })
  taskQueue: OrderTaskQueueEnum;

  @Column({ type: 'jsonb' })
  input: object;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;
}

export interface OrderWorkflowOutboxCreateEntityInterface
  extends Pick<OrderWorkflowOutbox, 'workflowId' | 'workflowType' | 'taskQueue' | 'input'> {}
