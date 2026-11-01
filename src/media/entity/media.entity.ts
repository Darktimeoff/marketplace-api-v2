import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { MediaKindEnum, MediaStatusEnum } from '@marketplace/contracts-core';
import { bigintNumberTransformer } from '../../generic/transformer/bigint-number.transformer.js';

@Entity('Media')
@Unique('Media_storageKey_key', ['storageKey'])
@Unique('Media_ownerIdentityPublicId_idempotencyKey_key', ['ownerIdentityPublicId', 'idempotencyKey'])
@Check('Media_sizeBytes_positive', `"sizeBytes" > 0`)
@Check('Media_storageKey_not_blank', `btrim("storageKey") <> ''`)
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

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

export interface MediaCreateEntityInterface
  extends Pick<Media, 'ownerIdentityPublicId' | 'kind' | 'storageKey' | 'mimeType' | 'sizeBytes' | 'uploadId' | 'idempotencyKey'> {}
