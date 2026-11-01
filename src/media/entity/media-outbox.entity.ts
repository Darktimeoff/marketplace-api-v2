import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';
import { MediaOutboxTypeEnum } from '../enum/media-outbox-type.enum.js';

@Entity('MediaOutbox')
@Index('MediaOutbox_unpublished_idx', ['createdAt'], { where: '"publishedAt" IS NULL' })
@Check('MediaOutbox_attempts_nonneg', `"attempts" >= 0`)
@Check('MediaOutbox_publishedAt_order', `"publishedAt" IS NULL OR "publishedAt" >= "createdAt"`)
export class MediaOutbox {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'MediaOutbox_pkey' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  queue: MediaQueueEnum;

  @Column({ type: 'varchar', length: 128 })
  type: MediaOutboxTypeEnum;

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

export interface MediaOutboxCreateEntityInterface extends Pick<MediaOutbox, 'id' | 'queue' | 'type' | 'payload'> {}
