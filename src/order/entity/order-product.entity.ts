import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Order } from './order.entity.js';
import { SellerOffer } from '../../seller-offer/entity/seller-offer.entity.js';
import { moneyTransformer } from '../../generic/transformer/money.transformer.js';

/**
 * M:N между Order и SellerOffer с данными на связи (количество и цены на момент
 * заказа), поэтому это явная join-entity с составным PK, а не @ManyToMany.
 */
@Entity('OrderProduct')
@Check('OrderProduct_discount_le', `"discountPrice" IS NULL OR "discountPrice" <= "price"`)
@Check('OrderProduct_deletedAt_ord', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class OrderProduct {
  @PrimaryColumn({ type: 'integer' })
  orderId: number;

  @PrimaryColumn({ type: 'integer' })
  offerId: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  price: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: moneyTransformer })
  discountPrice: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // CASCADE от заказа: позиция без заказа не существует.
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // RESTRICT от оффера: удаление оффера не должно вычищать позиции
  // из уже оформленных исторических заказов.
  @ManyToOne(() => SellerOffer, (offer) => offer.orderItems, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'offerId' })
  offer: SellerOffer;
}

export interface OrderProductCreateEntityInterface
  extends Pick<OrderProduct, 'orderId' | 'offerId' | 'quantity' | 'price' | 'discountPrice'> {}
