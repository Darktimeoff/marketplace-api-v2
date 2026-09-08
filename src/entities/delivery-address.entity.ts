import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { User } from './user.entity.js';
import type { OrderRecipient } from './order-recipient.entity.js';

@Entity('DeliveryAddress')
@Check('DeliveryAddress_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class DeliveryAddress {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  addressLine: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  building: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToOne('User', (user: User) => user.deliveryAddress)
  user: User | null;

  @OneToOne('OrderRecipient', (recipient: OrderRecipient) => recipient.deliveryAddress)
  orderRecipient: OrderRecipient | null;
}
