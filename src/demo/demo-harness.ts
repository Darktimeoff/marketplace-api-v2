// TODO(hw-23): remove after homework, shared harness of the redis demo scripts
import 'reflect-metadata';
import { Module, ValidationPipe, type DynamicModule, type INestApplication, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentModule } from '../generic/environment/environment.module.js';
import { DBModule } from '../generic/db/db.module.js';
import { Account } from '../account/entity/account.entity.js';
import { AccountInbox } from '../account/entity/account-inbox.entity.js';
import { Transaction } from '../account/entity/transaction.entity.js';
import { Brand } from '../brand/entity/brand.entity.js';
import { BrandTranslation } from '../brand/entity/brand-translation.entity.js';
import { Category } from '../category/entity/category.entity.js';
import { CategoryTranslation } from '../category/entity/category-translation.entity.js';
import { Identity } from '../identity/entity/identity.entity.js';
import { IdentityOutbox } from '../identity/entity/identity-outbox.entity.js';
import { IdentitySession } from '../identity/entity/identity-session.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { OrderLine } from '../order/entity/order-line.entity.js';
import { OrderOutbox } from '../order/entity/order-outbox.entity.js';
import { OrderRecipient } from '../order/entity/order-recipient.entity.js';
import { OrderWorkflowOutbox } from '../order/entity/order-workflow-outbox.entity.js';
import { Product } from '../product/entity/product.entity.js';
import { ProductTranslation } from '../product/entity/product-translation.entity.js';
import { ProductVariant } from '../product-variant/entity/product-variant.entity.js';
import { Seller } from '../seller/entity/seller.entity.js';
import { SellerOffer } from '../seller-offer/entity/seller-offer.entity.js';
import { StockReservation } from '../seller-offer/entity/stock-reservation.entity.js';
import { Address } from '../user/entity/address.entity.js';
import { User } from '../user/entity/user.entity.js';
import { UserOutbox } from '../user/entity/user-outbox.entity.js';

export async function startDemoApp(imports: (Type | DynamicModule)[]): Promise<INestApplication> {
  @Module({
    imports: [
      EnvironmentModule,
      DBModule,
      TypeOrmModule.forFeature([
        Account, AccountInbox, Transaction, Brand, BrandTranslation, Category, CategoryTranslation, Identity, IdentityOutbox, IdentitySession, Order, OrderLine, OrderOutbox, OrderRecipient, OrderWorkflowOutbox, Product, ProductTranslation, ProductVariant, Seller, SellerOffer, StockReservation, Address, User, UserOutbox,
      ]),
      ...imports,
    ],
  })
  class DemoModule {}

  const app = await NestFactory.create(DemoModule, { logger: ['error'] });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(0, '127.0.0.1');
  return app;
}

export function report(values: Record<string, number>, invariants: [string, boolean][]): number {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }

  const broken = invariants.filter(([, ok]) => !ok).map(([name]) => name);
  console.log(broken.length === 0 ? 'invariant=ok' : `invariant=broken: ${broken.join(', ')}`);
  return broken.length === 0 ? 0 : 1;
}

export async function run(scenario: () => Promise<number>): Promise<void> {
  let code = 2;

  try {
    code = await scenario();
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(code);
  }
}
