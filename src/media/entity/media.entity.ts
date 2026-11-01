import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { MediaAttachmentTypeEnum, MediaKindEnum, MediaStatusEnum } from '@marketplace/contracts-core';
import { bigintNumberTransformer } from '../../generic/transformer/bigint-number.transformer.js';

@Entity('Media')
@Unique('Media_storageKey_key', ['storageKey'])
@Unique('Media_ownerIdentityPublicId_idempotencyKey_key', ['ownerIdentityPublicId', 'idempotencyKey'])
@Check('Media_sizeBytes_positive', `"sizeBytes" > 0`)
@Check('Media_storageKey_not_blank', `btrim("storageKey") <> ''`)
@Check('Media_attachment_complete', `("attachedToType" IS NULL) = ("attachedToId" IS NULL) AND ("attachedToId" IS NULL) = ("attachedAt" IS NULL)`)
@Check('Media_claim_attached', `"claimExpiresAt" IS NULL OR "attachedToId" IS NOT NULL`)
@Index('Media_claimExpiresAt_idx', ['claimExpiresAt'], { where: '"claimExpiresAt" IS NOT NULL' })
export class Media {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  publicId: string;

  @Column({ type: 'uuid' })
  ownerIdentityPublicId: string;

  @Column({ type: 'enum', enum: MediaKindEnum, enumName: 'MediaKindEnum' })
  kind: MediaKindEnum;

  @Column({ type: 'enum', enum: MediaStatusEnum, enumName: 'MediaStatusEnum', default: MediaStatusEnum.PENDING })
  status: MediaStatusEnum;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ type: 'bigint', transformer: bigintNumberTransformer })
  sizeBytes: number;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  uploadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'enum', enum: MediaAttachmentTypeEnum, enumName: 'MediaAttachmentTypeEnum', nullable: true })
  attachedToType: MediaAttachmentTypeEnum | null;

  @Column({ type: 'uuid', nullable: true })
  attachedToId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  attachedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimExpiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

export interface MediaCreateEntityInterface
  extends Pick<Media, 'ownerIdentityPublicId' | 'kind' | 'storageKey' | 'mimeType' | 'sizeBytes' | 'uploadId' | 'idempotencyKey'> {}
