import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { Media } from './media.entity.js';
import { bigintNumberTransformer } from '../../generic/transformer/bigint-number.transformer.js';

@Entity('MediaVariant')
@Unique('MediaVariant_mediaId_name_key', ['mediaId', 'name'])
@Unique('MediaVariant_storageKey_key', ['storageKey'])
@Check('MediaVariant_sizeBytes_positive', `"sizeBytes" > 0`)
@Check('MediaVariant_dimensions_positive', `"width" > 0 AND "height" > 0`)
@Check('MediaVariant_storageKey_not_blank', `btrim("storageKey") <> ''`)
export class MediaVariant {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  mediaId: number;

  @Column({ type: 'enum', enum: MediaVariantNameEnum, enumName: 'MediaVariantNameEnum' })
  name: MediaVariantNameEnum;

  @Column({ type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ type: 'bigint', transformer: bigintNumberTransformer })
  sizeBytes: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => Media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mediaId' })
  media: Media;
}

export interface MediaVariantCreateEntityInterface
  extends Pick<MediaVariant, 'mediaId' | 'name' | 'mimeType' | 'storageKey' | 'width' | 'height' | 'sizeBytes'> {}
