import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CurrencyEnum, StatusEnum } from './enums.js';
import { OrderRecipient } from './order-recipient.entity.js';
import { moneyTransformer } from './money.transformer.js';
import type { OrderProduct } from './order-product.entity.js';

@Entity('Order')
@Check('Order_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Order {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  publicId: string;

  @Column({ type: 'integer' })
  orderRecipientId: number;

  // Переходы статусов валидирует приложение, не БД: машина состояний зависит
  // от роли, оплаты и прав, триггер дублировал бы эту логику.
  @Column({ type: 'enum', enum: StatusEnum, enumName: 'StatusEnum', default: StatusEnum.created })
  status: StatusEnum;

  // Снапшот на момент заказа: итог К ОПЛАТЕ, уже со скидкой.
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  totalAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: moneyTransformer })
  discountAmount: string;

  @Column({ type: 'enum', enum: CurrencyEnum, enumName: 'CurrencyEnum' })
  currency: CurrencyEnum;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToOne(() => OrderRecipient, (recipient) => recipient.order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderRecipientId' })
  orderRecipient: OrderRecipient;

  @OneToMany('OrderProduct', (item: OrderProduct) => item.order)
  items: OrderProduct[];
}
