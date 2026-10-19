import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { TopicEnum } from '@marketplace/messaging-contracts';
import { IdentityOutboxAggregateTypeEnum } from '../enum/identity-outbox-aggregate-type.enum.js';

@Entity('IdentityOutbox')
@Index('IdentityOutbox_unpublished_idx', ['createdAt'], { where: '"publishedAt" IS NULL' })
@Check('IdentityOutbox_attempts_nonneg', `"attempts" >= 0`)
@Check('IdentityOutbox_publishedAt_order', `"publishedAt" IS NULL OR "publishedAt" >= "createdAt"`)
export class IdentityOutbox {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'IdentityOutbox_pkey' })
  id: string;

  @Column({ type: 'varchar', length: 249 })
  topic: TopicEnum;

  @Column({ type: 'varchar', length: 64 })
  aggregateType: IdentityOutboxAggregateTypeEnum;

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

export interface IdentityOutboxCreateEntityInterface
  extends Pick<IdentityOutbox, 'id' | 'topic' | 'aggregateType' | 'aggregateId' | 'type' | 'payload'> {}
