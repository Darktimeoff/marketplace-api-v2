import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { MediaKindEnum } from '@marketplace/contracts-core';
import { Product } from './product.entity.js';
import { bigintNumberTransformer } from '../../generic/transformer/bigint-number.transformer.js';

@Entity('ProductMedia')
@Unique('ProductMedia_mediaPublicId_key', ['mediaPublicId'])
@Unique('ProductMedia_productId_position_key', ['productId', 'position'])
@Check('ProductMedia_position_nonneg', `"position" >= 0`)
export class ProductMedia {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  productId: number;

  @Column({ type: 'uuid' })
  mediaPublicId: string;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ type: 'enum', enum: MediaKindEnum, enumName: 'ProductMediaKindEnum' })
  kind: MediaKindEnum;

  @Column({ type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ type: 'bigint', transformer: bigintNumberTransformer })
  sizeBytes: number;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}

export interface ProductMediaCreateEntityInterface
  extends Pick<ProductMedia, 'productId' | 'mediaPublicId' | 'position' | 'kind' | 'mimeType' | 'sizeBytes' | 'storageKey'> {}
