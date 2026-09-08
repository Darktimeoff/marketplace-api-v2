import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { CurrencyEnum } from './enums.js';
import { Product } from './product.entity.js';
import { User } from './user.entity.js';
import { moneyTransformer } from './money.transformer.js';
import type { OrderProduct } from './order-product.entity.js';

@Entity('ProductOffer')
@Unique('ProductOffer_sellerId_sku', ['sellerId', 'sku'])
@Check('ProductOffer_sku_notBlank', `btrim("sku") <> ''`)
@Check('ProductOffer_discount_le', `"discountPrice" IS NULL OR "discountPrice" <= "price"`)
@Check('ProductOffer_deletedAt_ord', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class ProductOffer {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  productId: number;

  @Column({ type: 'integer' })
  sellerId: number;

  // Уникален парой (sellerId, sku): SKU — артикул продавца, а не платформы.
  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  price: string;

  @Column({ type: 'enum', enum: CurrencyEnum, enumName: 'CurrencyEnum' })
  currency: CurrencyEnum;

  // NULL = скидки нет, что отличается от «скидка 0».
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: moneyTransformer })
  discountPrice: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Product, (product) => product.offers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => User, (user) => user.offers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @OneToMany('OrderProduct', (item: OrderProduct) => item.productOffer)
  orderItems: OrderProduct[];
}
