import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { GenderEnum, LanguageEnum } from './enums.js';
import { Identity } from './identity.entity.js';
import { DeliveryAddress } from './delivery-address.entity.js';
import type { ProductOffer } from './product-offer.entity.js';
import type { OrderRecipient } from './order-recipient.entity.js';

@Entity('User')
@Check('User_dateOfBirth_past', `"dateOfBirth" IS NULL OR "dateOfBirth" < current_date`)
@Check('User_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class User {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  identityId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  // Generated-колонка: значение считает Postgres, приложение его не пишет.
  // coalesce нужен, потому что имя и фамилия nullable — иначе весь fullName стал бы NULL.
  @Column({
    type: 'varchar',
    length: 201,
    nullable: true,
    generatedType: 'STORED',
    asExpression: `nullif(trim(coalesce("firstName", '') || ' ' || coalesce("lastName", '')), '')`,
  })
  fullName: string | null;

  // date, а не timestamptz: день рождения — календарная дата, таймзона тут только вредит.
  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'enum', enum: GenderEnum, enumName: 'GenderEnum', nullable: true })
  gender: GenderEnum | null;

  @Column({ type: 'enum', enum: LanguageEnum, enumName: 'LanguageEnum', default: LanguageEnum.en })
  language: LanguageEnum;

  @Column({ type: 'varchar', length: 64, default: 'Europe/London' })
  timezone: string;

  @Column({ type: 'integer', nullable: true })
  deliveryAddressId: number | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToOne(() => Identity, (identity) => identity.user, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'identityId' })
  identity: Identity;

  @OneToOne(() => DeliveryAddress, (address) => address.user, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'deliveryAddressId' })
  deliveryAddress: DeliveryAddress | null;

  @OneToMany('ProductOffer', (offer: ProductOffer) => offer.seller)
  offers: ProductOffer[];

  @OneToMany('OrderRecipient', (recipient: OrderRecipient) => recipient.buyer)
  orderRecipients: OrderRecipient[];
}
