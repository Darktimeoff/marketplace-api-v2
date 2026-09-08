import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { LanguageEnum } from './enums.js';
import { Category } from './category.entity.js';

@Entity('CategoryTranslation')
@Unique('CategoryTranslation_categoryId_language', ['categoryId', 'language'])
@Check('CategoryTranslation_name_notBlank', `btrim("name") <> ''`)
export class CategoryTranslation {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  categoryId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: LanguageEnum, enumName: 'LanguageEnum' })
  language: LanguageEnum;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // CASCADE: перевод без категории бессмысленен.
  @ManyToOne(() => Category, (category) => category.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;
}
