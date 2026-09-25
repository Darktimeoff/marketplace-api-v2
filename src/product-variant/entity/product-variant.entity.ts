import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Product } from '../../product/entity/product.entity.js';
import type { SellerOffer } from '../../seller-offer/entity/seller-offer.entity.js';

@Entity('ProductVariant')
@Index('ProductVariant_productId_idx', ['productId'])
@Check('ProductVariant_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('ProductVariant_sku_notBlank', `btrim("sku") <> ''`)
@Check('ProductVariant_barcode_format', `"barcode" IS NULL OR "barcode" ~ '^[0-9]{8,14}$'`)
@Check('ProductVariant_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class ProductVariant {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  productId: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 14, nullable: true, unique: true })
  barcode: string | null;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @OneToMany('SellerOffer', (offer: SellerOffer) => offer.variant)
  offers: SellerOffer[];
}
