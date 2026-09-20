import type { MigrationInterface } from 'typeorm';
import { InitSchema1788889879820 } from '../../src/migrations/1788889879820-InitSchema.js';
import { AddQuantityTransactionsBackgroundJobs1789306283697 } from '../../src/migrations/1789306283697-AddQuantityTransactionsBackgroundJobs.js';
import { AddJobQueueProcessing1789405980915 } from '../../src/migrations/1789405980915-AddJobQueueProcessing.js';
import { entities as sharedEntities } from '../../src/entities/all.js';
import { Phone } from '../../src/entities/phone.entity.js';
import { DeliveryAddress } from '../../src/entities/delivery-address.entity.js';
import { ProductOffer } from '../../src/entities/product-offer.entity.js';
import { Transaction } from '../../src/entities/transaction.entity.js';
import { Product } from '../../src/product/entity/product.entity.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderProduct } from '../../src/order/entity/order-product.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import { BackgroundJob } from '../../src/background-job/entity/background-job.entity.js';

export const testMigrations: (new () => MigrationInterface)[] = [
  InitSchema1788889879820,
  AddQuantityTransactionsBackgroundJobs1789306283697,
  AddJobQueueProcessing1789405980915,
];

export const testEntities = [
  ...sharedEntities,
  Phone,
  DeliveryAddress,
  Product,
  ProductOffer,
  Transaction,
  Order,
  OrderProduct,
  OrderRecipient,
  BackgroundJob,
];
