import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { TopicEnum } from '@marketplace/messaging-contracts';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';
import { MediaOutboxAggregateTypeEnum } from '../enum/media-outbox-aggregate-type.enum.js';
import { MessageBrokerEnum } from '../../generic/messaging/enum/message-broker.enum.js';

@Entity('MediaOutbox')
@Index('MediaOutbox_unpublished_idx', ['createdAt'], { where: '"publishedAt" IS NULL' })
@Check('MediaOutbox_broker_known', `"broker" IN ('kafka', 'rabbitmq')`)
@Check('MediaOutbox_attempts_nonneg', `"attempts" >= 0`)
@Check('MediaOutbox_publishedAt_order', `"publishedAt" IS NULL OR "publishedAt" >= "createdAt"`)
export class MediaOutbox {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'MediaOutbox_pkey' })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  broker: MessageBrokerEnum;

  @Column({ type: 'varchar', length: 249 })
  topic: TopicEnum | MediaQueueEnum;

  @Column({ type: 'varchar', length: 64 })
  aggregateType: MediaOutboxAggregateTypeEnum;

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

export interface MediaOutboxCreateEntityInterface
  extends Pick<MediaOutbox, 'id' | 'broker' | 'topic' | 'aggregateType' | 'aggregateId' | 'type' | 'payload'> {}
