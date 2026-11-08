import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { ProductMedia } from './product-media.entity.js';

@Entity('ProductMediaVariant')
@Unique('ProductMediaVariant_productMediaId_name_key', ['productMediaId', 'name'])
@Check('ProductMediaVariant_dimensions_positive', `"width" > 0 AND "height" > 0`)
@Check('ProductMediaVariant_storageKey_not_blank', `btrim("storageKey") <> ''`)
export class ProductMediaVariant {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  productMediaId: number;

  @Column({ type: 'enum', enum: MediaVariantNameEnum, enumName: 'ProductMediaVariantNameEnum' })
  name: MediaVariantNameEnum;

  @Column({ type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @ManyToOne(() => ProductMedia, (productMedia) => productMedia.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productMediaId' })
  productMedia: ProductMedia;
}

export interface ProductMediaVariantCreateEntityInterface
  extends Pick<ProductMediaVariant, 'productMediaId' | 'name' | 'mimeType' | 'storageKey' | 'width' | 'height'> {}
