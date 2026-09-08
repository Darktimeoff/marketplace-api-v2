import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity.js';
import { Phone } from './phone.entity.js';
import { DeliveryAddress } from './delivery-address.entity.js';
import type { Order } from './order.entity.js';

/**
 * Снапшот получателя на момент оформления заказа. phoneId и deliveryAddressId —
 * НОВЫЕ строки Phone/DeliveryAddress, скопированные из профиля покупателя либо
 * введённые кастомно, поэтому связи 1:1. buyerId — N:1, у покупателя много заказов.
 */
@Entity('OrderRecipient')
@Check('OrderRecipient_fullName_notBlank', `btrim("fullName") <> ''`)
@Check('OrderRecipient_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class OrderRecipient {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  buyerId: number;

  @Column({ type: 'varchar', length: 201 })
  fullName: string;

  @Column({ type: 'integer' })
  phoneId: number;

  @Column({ type: 'integer' })
  deliveryAddressId: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // RESTRICT везде: снапшот — часть истории заказа, он не должен исчезать
  // из-за удаления профиля, телефона или адреса.
  @ManyToOne(() => User, (user) => user.orderRecipients, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @OneToOne(() => Phone, (phone) => phone.orderRecipient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'phoneId' })
  phone: Phone;

  @OneToOne(() => DeliveryAddress, (address) => address.orderRecipient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deliveryAddressId' })
  deliveryAddress: DeliveryAddress;

  @OneToOne('Order', (order: Order) => order.orderRecipient)
  order: Order | null;
}
