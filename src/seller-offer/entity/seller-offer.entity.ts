import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { CurrencyEnum } from '../../generic/enum/enums.js';
import { Seller } from '../../seller/entity/seller.entity.js';
import { ProductVariant } from '../../product-variant/entity/product-variant.entity.js';
import { moneyTransformer } from '../../generic/transformer/money.transformer.js';
import type { OrderProduct } from '../../order/entity/order-product.entity.js';

@Entity('SellerOffer')
@Unique('SellerOffer_sellerId_sellerSku', ['sellerId', 'sellerSku'])
@Unique('SellerOffer_sellerId_variantId', ['sellerId', 'variantId'])
@Check('SellerOffer_sellerSku_notBlank', `btrim("sellerSku") <> ''`)
@Check('SellerOffer_discount_le', `"discountPrice" IS NULL OR "discountPrice" <= "price"`)
@Check('SellerOffer_quantity_nonneg', `"quantity" >= 0`)
@Check('SellerOffer_deletedAt_ord', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class SellerOffer {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  sellerId: number;

  @Column({ type: 'integer' })
  variantId: number;

  // Уникален парой (sellerId, sellerSku): SKU — артикул продавца, а не платформы.
  @Column({ type: 'varchar', length: 64 })
  sellerSku: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  price: string;

  @Column({ type: 'enum', enum: CurrencyEnum, enumName: 'CurrencyEnum' })
  currency: CurrencyEnum;

  // NULL = скидки нет, что отличается от «скидка 0».
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: moneyTransformer })
  discountPrice: string | null;

  // Остаток на складе — счётчик штук, а не деньги, поэтому обычный integer,
  // а не домен "amount" (numeric(12,2), для денег). 0 = распродано, это
  // нормальное состояние, поэтому CHECK >= 0, а не домен "uint" (> 0).
  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Seller, (seller) => seller.offers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  @ManyToOne(() => ProductVariant, (variant) => variant.offers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant;

  @OneToMany('OrderProduct', (item: OrderProduct) => item.offer)
  orderItems: OrderProduct[];
}
