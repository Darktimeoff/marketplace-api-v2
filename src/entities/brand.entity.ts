import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { BrandTranslation } from './brand-translation.entity.js';
import type { Product } from './product.entity.js';

@Entity('Brand')
@Check('Brand_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('Brand_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Brand {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany('BrandTranslation', (translation: BrandTranslation) => translation.brand)
  translations: BrandTranslation[];

  @OneToMany('Product', (product: Product) => product.brand)
  products: Product[];
}
