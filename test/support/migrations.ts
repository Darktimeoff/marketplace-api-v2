import type { MigrationInterface } from 'typeorm';
import { InitSchema1788889879820 } from '../../src/migrations/1788889879820-InitSchema.js';
import { AddQuantityTransactionsBackgroundJobs1789306283697 } from '../../src/migrations/1789306283697-AddQuantityTransactionsBackgroundJobs.js';
import { AddJobQueueProcessing1789405980915 } from '../../src/migrations/1789405980915-AddJobQueueProcessing.js';
import { SplitProductVariantSellerOffer1789862400000 } from '../../src/migrations/1789862400000-SplitProductVariantSellerOffer.js';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { User } from '../../src/user/entity/user.entity.js';
import { Brand } from '../../src/brand/entity/brand.entity.js';
import { BrandTranslation } from '../../src/brand/entity/brand-translation.entity.js';
import { Category } from '../../src/category/entity/category.entity.js';
import { CategoryTranslation } from '../../src/category/entity/category-translation.entity.js';
import { Phone } from '../../src/phone/entity/phone.entity.js';
import { DeliveryAddress } from '../../src/delivery-address/entity/delivery-address.entity.js';
import { Product } from '../../src/product/entity/product.entity.js';
import { ProductTranslation } from '../../src/product/entity/product-translation.entity.js';
import { ProductVariant } from '../../src/product-variant/entity/product-variant.entity.js';
import { Seller } from '../../src/seller/entity/seller.entity.js';
import { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderProduct } from '../../src/order/entity/order-product.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import { BackgroundJob } from '../../src/background-job/entity/background-job.entity.js';

export const testMigrations: (new () => MigrationInterface)[] = [
  InitSchema1788889879820,
  AddQuantityTransactionsBackgroundJobs1789306283697,
  AddJobQueueProcessing1789405980915,
  SplitProductVariantSellerOffer1789862400000,
];

export const testEntities = [
  Identity,
  User,
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  Phone,
  DeliveryAddress,
  Product,
  ProductTranslation,
  ProductVariant,
  Seller,
  SellerOffer,
  Transaction,
  Order,
  OrderProduct,
  OrderRecipient,
  BackgroundJob,
];
