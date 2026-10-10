import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { TopicEnum } from '@marketplace/messaging-contracts';
import { OrderOutboxAggregateTypeEnum } from '../enum/order-outbox-aggregate-type.enum.js';
import { OrderOutboxBrokerEnum } from '../enum/order-outbox-broker.enum.js';

@Entity('OrderOutbox')
@Index('OrderOutbox_unpublished_idx', ['createdAt'], { where: '"publishedAt" IS NULL' })
@Check('OrderOutbox_broker_known', `"broker" IN ('rabbitmq', 'kafka')`)
@Check('OrderOutbox_attempts_nonneg', `"attempts" >= 0`)
@Check('OrderOutbox_publishedAt_order', `"publishedAt" IS NULL OR "publishedAt" >= "createdAt"`)
export class OrderOutbox {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'OrderOutbox_pkey' })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  broker: OrderOutboxBrokerEnum;

  @Column({ type: 'varchar', length: 249 })
  topic: TopicEnum;

  @Column({ type: 'varchar', length: 64 })
  aggregateType: OrderOutboxAggregateTypeEnum;

  @Column({ type: 'varchar', length: 64 })
  aggregateId: string;

  @Column({ type: 'varchar', length: 128 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: object;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;
}

export interface OrderOutboxCreateEntityInterface
  extends Pick<OrderOutbox, 'id' | 'broker' | 'topic' | 'aggregateType' | 'aggregateId' | 'type' | 'payload'> {}
