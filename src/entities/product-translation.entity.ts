import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { LanguageEnum } from './enums.js';
import { Product } from './product.entity.js';

@Entity('ProductTranslation')
@Unique('ProductTranslation_productId_language', ['productId', 'language'])
@Check('ProductTranslation_title_notBlank', `btrim("title") <> ''`)
export class ProductTranslation {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  productId: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: LanguageEnum, enumName: 'LanguageEnum' })
  language: LanguageEnum;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // CASCADE: перевод без товара бессмысленен.
  @ManyToOne(() => Product, (product) => product.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
