import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CountryCodeEnum } from './enums.js';
import type { Identity } from './identity.entity.js';
import type { OrderRecipient } from './order-recipient.entity.js';

// "fullNumber" намеренно НЕ unique: OrderRecipient делает снапшот-копию номера
// на каждый заказ, поэтому дубликаты в этой таблице — норма.
@Entity('Phone')
@Check('Phone_fullNumber_e164', `"fullNumber" ~ '^\\+[1-9][0-9]{7,14}$'`)
@Check('Phone_nationalNumber_fmt', `"nationalNumber" ~ '^[0-9]{4,15}$'`)
@Check('Phone_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Phone {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'enum', enum: CountryCodeEnum, enumName: 'CountryCodeEnum' })
  countryCode: CountryCodeEnum;

  @Column({ type: 'varchar', length: 32 })
  rawNumber: string;

  @Column({ type: 'varchar', length: 16 })
  fullNumber: string;

  @Column({ type: 'varchar', length: 15 })
  nationalNumber: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToOne('Identity', (identity: Identity) => identity.phone)
  identity: Identity | null;

  @OneToOne('OrderRecipient', (recipient: OrderRecipient) => recipient.phone)
  orderRecipient: OrderRecipient | null;
}
