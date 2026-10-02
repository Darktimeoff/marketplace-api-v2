import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Order } from './order.entity.js';
import { RecipientPhone } from '../value-object/recipient-phone.value-object.js';
import { RecipientAddress } from '../value-object/recipient-address.value-object.js';

@Entity('OrderRecipient')
@Check('OrderRecipient_fullName_notBlank', `btrim("fullName") <> ''`)
@Check('OrderRecipient_phoneFullNumber_e164', `"phoneFullNumber" ~ '^\\+[1-9][0-9]{7,14}$'`)
@Check('OrderRecipient_phoneNationalNumber_fmt', `"phoneNationalNumber" ~ '^[0-9]{4,15}$'`)
@Check('OrderRecipient_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class OrderRecipient {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'varchar', length: 201 })
  fullName: string;

  @Column(() => RecipientPhone, { prefix: false })
  phone: RecipientPhone;

  @Column(() => RecipientAddress, { prefix: false })
  address: RecipientAddress;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToOne('Order', (order: Order) => order.orderRecipient)
  order: Order | null;
}

export interface OrderRecipientCreateEntityInterface
  extends Pick<OrderRecipient, 'fullName' | 'phone' | 'address'> {}
