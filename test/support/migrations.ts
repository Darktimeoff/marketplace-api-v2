import type { MigrationInterface } from 'typeorm';
import { InitSchema1788889879820 } from '../../src/migrations/1788889879820-InitSchema.js';
import { AddQuantityTransactionsBackgroundJobs1789306283697 } from '../../src/migrations/1789306283697-AddQuantityTransactionsBackgroundJobs.js';
import { AddJobQueueProcessing1789405980915 } from '../../src/migrations/1789405980915-AddJobQueueProcessing.js';
import { SplitProductVariantSellerOffer1789862400000 } from '../../src/migrations/1789862400000-SplitProductVariantSellerOffer.js';
import { AddEmailInbox1790865132059 } from '../../src/migrations/1790865132059-AddEmailInbox.js';
import { RenameEmailInboxToInbox1790879681248 } from '../../src/migrations/1790879681248-RenameEmailInboxToInbox.js';
import { AddStockReservation1790931836340 } from '../../src/migrations/1790931836340-AddStockReservation.js';
import { AddReservedStock1790944531186 } from '../../src/migrations/1790944531186-AddReservedStock.js';
import { AddRefundTransactionType1790948285224 } from '../../src/migrations/1790948285224-AddRefundTransactionType.js';
import { AddAccountInbox1790948332938 } from '../../src/migrations/1790948332938-AddAccountInbox.js';
import { AddAccountBalance1790949258576 } from '../../src/migrations/1790949258576-AddAccountBalance.js';
import { LinkTransactionToAccount1790949513750 } from '../../src/migrations/1790949513750-LinkTransactionToAccount.js';
import { DropInboxAndBackgroundJob1790949940010 } from '../../src/migrations/1790949940010-DropInboxAndBackgroundJob.js';
import { OrderOwnsUserAndContact1791000000000 } from '../../src/migrations/1791000000000-OrderOwnsUserAndContact.js';
import { IdentityOwnsLoginPhone1791000000010 } from '../../src/migrations/1791000000010-IdentityOwnsLoginPhone.js';
import { RenameDeliveryAddressToAddress1791000000020 } from '../../src/migrations/1791000000020-RenameDeliveryAddressToAddress.js';
import { RenameOrderProductToOrderLine1791000000030 } from '../../src/migrations/1791000000030-RenameOrderProductToOrderLine.js';
import { RenameOnHandQuantity1791000000040 } from '../../src/migrations/1791000000040-RenameOnHandQuantity.js';
import { AddIdentitySession1791000000050 } from '../../src/migrations/1791000000050-AddIdentitySession.js';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { IdentitySession } from '../../src/identity/entity/identity-session.entity.js';
import { User } from '../../src/user/entity/user.entity.js';
import { Brand } from '../../src/brand/entity/brand.entity.js';
import { BrandTranslation } from '../../src/brand/entity/brand-translation.entity.js';
import { Category } from '../../src/category/entity/category.entity.js';
import { CategoryTranslation } from '../../src/category/entity/category-translation.entity.js';
import { Address } from '../../src/user/entity/address.entity.js';
import { Product } from '../../src/product/entity/product.entity.js';
import { ProductTranslation } from '../../src/product/entity/product-translation.entity.js';
import { ProductVariant } from '../../src/product-variant/entity/product-variant.entity.js';
import { Seller } from '../../src/seller/entity/seller.entity.js';
import { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { Account } from '../../src/account/entity/account.entity.js';
import { AccountInbox } from '../../src/account/entity/account-inbox.entity.js';
import { StockReservation } from '../../src/seller-offer/entity/stock-reservation.entity.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderLine } from '../../src/order/entity/order-line.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';

export const testMigrations: (new () => MigrationInterface)[] = [
  InitSchema1788889879820,
  AddQuantityTransactionsBackgroundJobs1789306283697,
  AddJobQueueProcessing1789405980915,
  SplitProductVariantSellerOffer1789862400000,
  AddEmailInbox1790865132059,
  RenameEmailInboxToInbox1790879681248,
  AddStockReservation1790931836340,
  AddReservedStock1790944531186,
  AddRefundTransactionType1790948285224,
  AddAccountInbox1790948332938,
  AddAccountBalance1790949258576,
  LinkTransactionToAccount1790949513750,
  DropInboxAndBackgroundJob1790949940010,
  OrderOwnsUserAndContact1791000000000,
  IdentityOwnsLoginPhone1791000000010,
  RenameDeliveryAddressToAddress1791000000020,
  RenameOrderProductToOrderLine1791000000030,
  RenameOnHandQuantity1791000000040,
  AddIdentitySession1791000000050,
];

export const testEntities = [
  Identity,
  IdentitySession,
  User,
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  Address,
  Product,
  ProductTranslation,
  ProductVariant,
  Seller,
  SellerOffer,
  StockReservation,
  Account,
  AccountInbox,
  Transaction,
  Order,
  OrderLine,
  OrderRecipient,
];
