import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { CategoryTranslation } from './category-translation.entity.js';
import type { Product } from './product.entity.js';

@Entity('Category')
@Check('Category_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('Category_no_self_parent', `"parentCategoryId" IS DISTINCT FROM "id"`)
@Check('Category_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Category {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  // NULL = корень дерева.
  @Column({ type: 'integer', nullable: true })
  parentCategoryId: number | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // RESTRICT: удаление родителя не должно молча уносить поддерево каталога.
  @ManyToOne(() => Category, (category) => category.children, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parentCategoryId' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany('CategoryTranslation', (translation: CategoryTranslation) => translation.category)
  translations: CategoryTranslation[];

  @OneToMany('Product', (product: Product) => product.category)
  products: Product[];
}
