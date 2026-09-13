import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { LanguageEnum } from './enums.js';
import { Brand } from './brand.entity.js';

@Entity('BrandTranslation')
@Unique('BrandTranslation_brandId_language', ['brandId', 'language'])
@Check('BrandTranslation_name_notBlank', `btrim("name") <> ''`)
export class BrandTranslation {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  brandId: number;

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

  // CASCADE: перевод без бренда бессмысленен и не должен переживать родителя.
  @ManyToOne(() => Brand, (brand) => brand.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brandId' })
  brand: Brand;
}
