import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Category } from './category.entity.js';
import { Brand } from './brand.entity.js';
import type { ProductTranslation } from './product-translation.entity.js';
import type { ProductOffer } from './product-offer.entity.js';

@Entity('Product')
@Check('Product_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('Product_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Product {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  categoryId: number;

  @Column({ type: 'integer' })
  brandId: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // RESTRICT: категория и бренд — справочники, их удаление не должно сносить каталог.
  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @ManyToOne(() => Brand, (brand) => brand.products, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brandId' })
  brand: Brand;

  @OneToMany('ProductTranslation', (translation: ProductTranslation) => translation.product)
  translations: ProductTranslation[];

  @OneToMany('ProductOffer', (offer: ProductOffer) => offer.product)
  offers: ProductOffer[];
}
