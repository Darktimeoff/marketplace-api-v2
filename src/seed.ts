import 'reflect-metadata';
import { DeepPartial, FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import { argon2id, hash } from 'argon2';
import { AppDataSource } from './data-source.js';
import { CountryCodeEnum, CurrencyEnum, OrderStatusEnum, LanguageEnum } from '@marketplace/contracts-core';
import { Identity } from './identity/entity/identity.entity.js';
import { User } from './user/entity/user.entity.js';
import { Address } from './user/entity/address.entity.js';
import { Brand } from './brand/entity/brand.entity.js';
import { BrandTranslation } from './brand/entity/brand-translation.entity.js';
import { Category } from './category/entity/category.entity.js';
import { CategoryTranslation } from './category/entity/category-translation.entity.js';
import { Product } from './product/entity/product.entity.js';
import { ProductTranslation } from './product/entity/product-translation.entity.js';
import { ProductVariant } from './product-variant/entity/product-variant.entity.js';
import { Seller } from './seller/entity/seller.entity.js';
import { SellerOffer } from './seller-offer/entity/seller-offer.entity.js';
import { Transaction } from './account/entity/transaction.entity.js';
import { Order } from './order/entity/order.entity.js';
import { OrderLine } from './order/entity/order-line.entity.js';
import { OrderRecipient } from './order/entity/order-recipient.entity.js';
import { GenderEnum } from './user/enum/gender.enum.js';
import { RoleEnum } from './identity/enum/role.enum.js';
import { TransactionStatusEnum } from './account/enum/transaction-status.enum.js';
import { TransactionTypeEnum } from './account/enum/transaction-type.enum.js';

/**
 * Детерминированный идемпотентный seed: никакого random() и Date.now(), каждая строка
 * ищется по естественному ключу и создаётся только если её нет. Поэтому второй запуск
 * ничего не дублирует и не падает на unique-констрейнтах.
 */
async function ensure<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
  data: DeepPartial<T>,
): Promise<T> {
  const existing = await repo.findOne({ where });

  if (existing) {
    return existing;
  }

  return repo.save(repo.create(data));
}

const SELLERS = 2;
const BUYERS = 4;
const SEED_PASSWORD = 'marketplace-dev';
const ORDERS = 10;

function phoneFor(index: number) {
  const national = String(100000000 + index);

  return {
    countryCode: CountryCodeEnum.UA,
    rawNumber: `0${national}`,
    fullNumber: `+380${national}`,
    nationalNumber: national,
  };
}

async function seed(): Promise<void> {
  const addresses = AppDataSource.getRepository(Address);
  const identities = AppDataSource.getRepository(Identity);
  const users = AppDataSource.getRepository(User);
  const brands = AppDataSource.getRepository(Brand);
  const brandTranslations = AppDataSource.getRepository(BrandTranslation);
  const categories = AppDataSource.getRepository(Category);
  const categoryTranslations = AppDataSource.getRepository(CategoryTranslation);
  const products = AppDataSource.getRepository(Product);
  const productTranslations = AppDataSource.getRepository(ProductTranslation);
  const variants = AppDataSource.getRepository(ProductVariant);
  const sellerRepo = AppDataSource.getRepository(Seller);
  const offers = AppDataSource.getRepository(SellerOffer);
  const recipients = AppDataSource.getRepository(OrderRecipient);
  const orders = AppDataSource.getRepository(Order);
  const orderLines = AppDataSource.getRepository(OrderLine);
  const transactions = AppDataSource.getRepository(Transaction);

  const cities = ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'];

  // ---------- категории: 2 корня + 4 ребёнка ----------
  const categoryRows: Category[] = [];

  for (let i = 0; i < 6; i++) {
    const slug = `category-${i + 1}`;
    const parent = i < 2 ? null : categoryRows[i % 2];

    const category = await ensure(categories, { slug } as FindOptionsWhere<Category>, {
      slug,
      parentCategoryId: parent ? parent.id : null,
    });

    categoryRows.push(category);

    for (const language of [LanguageEnum.en, LanguageEnum.ua]) {
      await ensure(
        categoryTranslations,
        { categoryId: category.id, language } as FindOptionsWhere<CategoryTranslation>,
        { categoryId: category.id, language, name: `Category ${i + 1} (${language})` },
      );
    }
  }

  // ---------- бренды ----------
  const brandRows: Brand[] = [];

  for (let i = 0; i < 5; i++) {
    const slug = `brand-${i + 1}`;
    const brand = await ensure(brands, { slug } as FindOptionsWhere<Brand>, { slug });
    brandRows.push(brand);

    for (const language of [LanguageEnum.en, LanguageEnum.ua]) {
      await ensure(
        brandTranslations,
        { brandId: brand.id, language } as FindOptionsWhere<BrandTranslation>,
        { brandId: brand.id, language, name: `Brand ${i + 1} (${language})` },
      );
    }
  }

  // ---------- пользователи: продавцы и покупатели ----------
  const userRows: User[] = [];
  const seedPasswordHash = await hash(SEED_PASSWORD, { type: argon2id });

  for (let i = 0; i < SELLERS + BUYERS; i++) {
    const isSeller = i < SELLERS;
    const email = `${isSeller ? 'seller' : 'buyer'}${(isSeller ? i : i - SELLERS) + 1}@example.com`;

    let identity = await identities.findOne({ where: { email } });

    if (!identity) {
      identity = await identities.save(
        identities.create({
          email,
          loginPhone: phoneFor(i),
          passwordHash: seedPasswordHash,
          role: isSeller ? RoleEnum.seller : RoleEnum.user,
          // activatedAt проставляется ниже одним UPDATE: CHECK Identity_activatedAt_ord
          // требует activatedAt >= createdAt, а createdAt приходит из DEFAULT now()
          // уже на стороне БД, поэтому в JS его значение на момент вставки неизвестно.
          activatedAt: null,
        }),
      );
    } else if (!identity.passwordHash.startsWith('$argon2id$')) {
      await identities.update({ id: identity.id }, { passwordHash: seedPasswordHash });
    }

    let user = await users.findOne({ where: { identityId: identity.id } });

    if (!user) {
      const address = await addresses.save(
        addresses.create({
          addressLine: `Seed street ${i + 1}`,
          city: cities[i % cities.length],
          building: String(i + 1),
        }),
      );

      user = await users.save(
        users.create({
          identityId: identity.id,
          email: identity.email,
          phoneNumber: identity.loginPhone.fullNumber,
          firstName: isSeller ? `Seller${i + 1}` : `Buyer${i - SELLERS + 1}`,
          lastName: 'Seeded',
          dateOfBirth: '1990-01-01',
          gender: i % 2 === 0 ? GenderEnum.male : GenderEnum.female,
          language: LanguageEnum.ua,
          timezone: 'Europe/Kyiv',
          addressId: address.id,
        }),
      );
    }

    userRows.push(user);
  }

  await AppDataSource.query(
    `UPDATE "Identity" SET "activatedAt" = "createdAt" WHERE "activatedAt" IS NULL`,
  );

  const sellers = userRows.slice(0, SELLERS);
  const buyers = userRows.slice(SELLERS);

  const sellerRows: Seller[] = [];

  for (const sellerUser of sellers) {
    const seller = await ensure(
      sellerRepo,
      { userId: sellerUser.id } as FindOptionsWhere<Seller>,
      { userId: sellerUser.id },
    );

    sellerRows.push(seller);
  }

  // ---------- товары ----------
  const productRows: Product[] = [];
  const variantRows: ProductVariant[] = [];

  for (let i = 0; i < 8; i++) {
    const slug = `product-${i + 1}`;
    const title = `Seeded product ${i + 1}`;

    const existingTranslation = await productTranslations.findOne({
      where: { title, language: LanguageEnum.en },
    });

    const product = existingTranslation
      ? await products.findOneByOrFail({ id: existingTranslation.productId })
      : await products.save(
          products.create({
            categoryId: categoryRows[2 + (i % 4)].id,
            brandId: brandRows[i % brandRows.length].id,
          }),
        );

    productRows.push(product);

    await ensure(
      productTranslations,
      { productId: product.id, language: LanguageEnum.en } as FindOptionsWhere<ProductTranslation>,
      {
        productId: product.id,
        language: LanguageEnum.en,
        title,
        description: `Description of seeded product ${i + 1}`,
      },
    );

    await ensure(
      productTranslations,
      { productId: product.id, language: LanguageEnum.ua } as FindOptionsWhere<ProductTranslation>,
      { productId: product.id, language: LanguageEnum.ua, title: `Товар ${i + 1}`, description: null },
    );

    const variant = await ensure(variants, { sku: slug } as FindOptionsWhere<ProductVariant>, {
      productId: product.id,
      sku: slug,
      slug,
      barcode: null,
    });

    variantRows.push(variant);
  }

  // ---------- офферы ----------
  const offerRows: SellerOffer[] = [];

  for (let i = 0; i < 10; i++) {
    const seller = sellerRows[i % SELLERS];
    const variant = variantRows[Math.floor(i / SELLERS) % variantRows.length];
    const sellerSku = `SEED-SKU-${i + 1}`;

    const offer = await ensure(
      offers,
      { sellerId: seller.id, sellerSku } as FindOptionsWhere<SellerOffer>,
      {
        sellerId: seller.id,
        sellerSku,
        variantId: variant.id,
        price: (100 + i * 25).toFixed(2),
        currency: CurrencyEnum.UAH,
        discountPrice: i % 3 === 0 ? (90 + i * 25).toFixed(2) : null,
        // Перекос: часть офферов распродана (0), у остальных остаток растёт по i.
        onHandQuantity: i % 4 === 0 ? 0 : (i + 1) * 5,
      },
    );

    offerRows.push(offer);
  }

  // ---------- заказы со снапшотом получателя ----------
  const statuses = [
    OrderStatusEnum.completed,
    OrderStatusEnum.delivered,
    OrderStatusEnum.paid,
    OrderStatusEnum.shipped,
    OrderStatusEnum.canceled,
  ];

  for (let i = 0; i < ORDERS; i++) {
    // Детерминированный publicId вместо gen_random_uuid(): он же служит ключом идемпотентности.
    const publicId = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const existingOrder = await orders.findOne({ where: { publicId } });

    if (existingOrder) {
      continue;
    }

    const buyer = buyers[i % buyers.length];

    const recipient = await recipients.save(
      recipients.create({
        fullName: `${buyer.firstName} ${buyer.lastName}`,
        phone: phoneFor(100 + i),
        address: {
          addressLine: `Seed delivery ${i + 1}`,
          city: cities[i % cities.length],
          building: String(i + 1),
        },
      }),
    );

    // 2 позиции на заказ; цены — снапшот цены оффера на момент заказа.
    const items = [offerRows[i % offerRows.length], offerRows[(i + 3) % offerRows.length]];
    const total = items.reduce((sum, offer) => sum + Number(offer.price), 0);

    const order = await orders.save(
      orders.create({
        publicId,
        userId: buyer.id,
        orderRecipientId: recipient.id,
        status: statuses[i % statuses.length],
        totalAmount: total.toFixed(2),
        discountAmount: '0.00',
        currency: CurrencyEnum.UAH,
      }),
    );

    for (const [position, offer] of items.entries()) {
      await ensure(
        orderLines,
        { orderId: order.id, offerId: offer.id } as FindOptionsWhere<OrderLine>,
        {
          orderId: order.id,
          offerId: offer.id,
          quantity: position + 1,
          unitPrice: offer.price,
          unitDiscountPrice: offer.discountPrice,
        },
      );
    }

    // Оплата заказа — денежная проводка покупателя. amount неотрицателен
    // (домен "amount"), направление денег кодирует type = PAYMENT.
    const paidStatuses = [OrderStatusEnum.paid, OrderStatusEnum.shipped, OrderStatusEnum.delivered, OrderStatusEnum.completed];

    await AppDataSource.query(`INSERT INTO "Account" ("customerId") VALUES ($1) ON CONFLICT ("customerId") DO NOTHING`, [buyer.id]);

    await ensure(
      transactions,
      { customerId: buyer.id, amount: total.toFixed(2), type: TransactionTypeEnum.PAYMENT } as FindOptionsWhere<Transaction>,
      {
        customerId: buyer.id,
        amount: total.toFixed(2),
        type: TransactionTypeEnum.PAYMENT,
        status: paidStatuses.includes(order.status) ? TransactionStatusEnum.SUCCESS : TransactionStatusEnum.PENDING,
      },
    );
  }

  await AppDataSource.query(
    `INSERT INTO "Account" ("customerId", "balance")
     SELECT "customerId", COALESCE(SUM(CASE WHEN "type" IN ('DEPOSIT', 'REFUND') THEN "amount" ELSE -"amount" END) FILTER (WHERE "status" = 'SUCCESS'), 0)
       FROM "Transaction"
      WHERE "deletedAt" IS NULL
      GROUP BY "customerId"
     ON CONFLICT ("customerId") DO UPDATE SET "balance" = EXCLUDED."balance"`,
  );
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    await seed();

    const counts = await Promise.all(
      ['Category', 'Brand', 'User', 'Product', 'Seller', 'ProductVariant', 'SellerOffer', 'Order', 'OrderLine', 'Transaction'].map(
        async (table) => {
          const [row] = await AppDataSource.query(`SELECT count(*)::int AS count FROM "${table}"`);

          return `${table}=${row.count}`;
        },
      ),
    );

    console.log('seed ok:', counts.join(' '));
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
