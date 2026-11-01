import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { TopicEnum } from '@marketplace/messaging-contracts';
import { ProductOutboxAggregateTypeEnum } from '../enum/product-outbox-aggregate-type.enum.js';
import { MessageBrokerEnum } from '../../generic/messaging/enum/message-broker.enum.js';

@Entity('ProductOutbox')
@Index('ProductOutbox_unpublished_idx', ['createdAt'], { where: '"publishedAt" IS NULL' })
@Check('ProductOutbox_broker_known', `"broker" IN ('kafka', 'rabbitmq')`)
@Check('ProductOutbox_attempts_nonneg', `"attempts" >= 0`)
@Check('ProductOutbox_publishedAt_order', `"publishedAt" IS NULL OR "publishedAt" >= "createdAt"`)
export class ProductOutbox {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'ProductOutbox_pkey' })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  broker: MessageBrokerEnum;

  @Column({ type: 'varchar', length: 249 })
  topic: TopicEnum;

  @Column({ type: 'varchar', length: 64 })
  aggregateType: ProductOutboxAggregateTypeEnum;

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

export interface ProductOutboxCreateEntityInterface
  extends Pick<ProductOutbox, 'id' | 'broker' | 'topic' | 'aggregateType' | 'aggregateId' | 'type' | 'payload'> {}
