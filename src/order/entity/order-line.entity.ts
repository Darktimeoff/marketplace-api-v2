import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Order } from './order.entity.js';
import { moneyTransformer } from '../../generic/transformer/money.transformer.js';

/**
 * M:N между Order и SellerOffer с данными на связи (количество и цены на момент
 * заказа), поэтому это явная join-entity с составным PK, а не @ManyToMany.
 */
@Entity('OrderLine')
@Check('OrderLine_discount_le', `"unitDiscountPrice" IS NULL OR "unitDiscountPrice" <= "unitPrice"`)
@Check('OrderLine_deletedAt_ord', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class OrderLine {
  @PrimaryColumn({ type: 'integer' })
  orderId: number;

  @PrimaryColumn({ type: 'integer' })
  offerId: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: moneyTransformer })
  unitDiscountPrice: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // CASCADE от заказа: позиция без заказа не существует.
  @ManyToOne(() => Order, (order) => order.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}

export interface OrderLineCreateEntityInterface
  extends Pick<OrderLine, 'orderId' | 'offerId' | 'quantity' | 'unitPrice' | 'unitDiscountPrice'> {}
