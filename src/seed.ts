import 'reflect-metadata';
import { DeepPartial, FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import { AppDataSource } from './data-source.js';
import {
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  CountryCodeEnum,
  CurrencyEnum,
  DeliveryAddress,
  GenderEnum,
  Identity,
  LanguageEnum,
  Order,
  OrderProduct,
  OrderRecipient,
  Phone,
  Product,
  ProductOffer,
  ProductTranslation,
  RoleEnum,
  StatusEnum,
  User,
} from './entities/index.js';

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
  const phones = AppDataSource.getRepository(Phone);
  const addresses = AppDataSource.getRepository(DeliveryAddress);
  const identities = AppDataSource.getRepository(Identity);
  const users = AppDataSource.getRepository(User);
  const brands = AppDataSource.getRepository(Brand);
  const brandTranslations = AppDataSource.getRepository(BrandTranslation);
  const categories = AppDataSource.getRepository(Category);
  const categoryTranslations = AppDataSource.getRepository(CategoryTranslation);
  const products = AppDataSource.getRepository(Product);
  const productTranslations = AppDataSource.getRepository(ProductTranslation);
  const offers = AppDataSource.getRepository(ProductOffer);
  const recipients = AppDataSource.getRepository(OrderRecipient);
  const orders = AppDataSource.getRepository(Order);
  const orderProducts = AppDataSource.getRepository(OrderProduct);

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

  for (let i = 0; i < SELLERS + BUYERS; i++) {
    const isSeller = i < SELLERS;
    const email = `${isSeller ? 'seller' : 'buyer'}${(isSeller ? i : i - SELLERS) + 1}@example.com`;

    let identity = await identities.findOne({ where: { email } });

    if (!identity) {
      const phone = await phones.save(phones.create(phoneFor(i)));

      identity = await identities.save(
        identities.create({
          email,
          phoneId: phone.id,
          passwordHash: `$2b$10$seed.deterministic.hash.${i}`,
          role: isSeller ? RoleEnum.seller : RoleEnum.user,
          // activatedAt проставляется ниже одним UPDATE: CHECK Identity_activatedAt_ord
          // требует activatedAt >= createdAt, а createdAt приходит из DEFAULT now()
          // уже на стороне БД, поэтому в JS его значение на момент вставки неизвестно.
          activatedAt: null,
        }),
      );
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
          firstName: isSeller ? `Seller${i + 1}` : `Buyer${i - SELLERS + 1}`,
          lastName: 'Seeded',
          dateOfBirth: '1990-01-01',
          gender: i % 2 === 0 ? GenderEnum.male : GenderEnum.female,
          language: LanguageEnum.ua,
          timezone: 'Europe/Kyiv',
          deliveryAddressId: address.id,
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

  // ---------- товары ----------
  const productRows: Product[] = [];

  for (let i = 0; i < 8; i++) {
    const slug = `product-${i + 1}`;

    const product = await ensure(products, { slug } as FindOptionsWhere<Product>, {
      slug,
      categoryId: categoryRows[2 + (i % 4)].id,
      brandId: brandRows[i % brandRows.length].id,
    });

    productRows.push(product);

    await ensure(
      productTranslations,
      { productId: product.id, language: LanguageEnum.en } as FindOptionsWhere<ProductTranslation>,
      {
        productId: product.id,
        language: LanguageEnum.en,
        title: `Seeded product ${i + 1}`,
        description: `Description of seeded product ${i + 1}`,
      },
    );

    await ensure(
      productTranslations,
      { productId: product.id, language: LanguageEnum.ua } as FindOptionsWhere<ProductTranslation>,
      { productId: product.id, language: LanguageEnum.ua, title: `Товар ${i + 1}`, description: null },
    );
  }

  // ---------- офферы ----------
  const offerRows: ProductOffer[] = [];

  for (let i = 0; i < 10; i++) {
    const seller = sellers[i % SELLERS];
    const sku = `SEED-SKU-${i + 1}`;

    const offer = await ensure(
      offers,
      { sellerId: seller.id, sku } as FindOptionsWhere<ProductOffer>,
      {
        sellerId: seller.id,
        sku,
        productId: productRows[i % productRows.length].id,
        price: (100 + i * 25).toFixed(2),
        currency: CurrencyEnum.UAH,
        discountPrice: i % 3 === 0 ? (90 + i * 25).toFixed(2) : null,
      },
    );

    offerRows.push(offer);
  }

  // ---------- заказы со снапшотом получателя ----------
  const statuses = [
    StatusEnum.completed,
    StatusEnum.delivered,
    StatusEnum.paid,
    StatusEnum.shipped,
    StatusEnum.canceled,
  ];

  for (let i = 0; i < ORDERS; i++) {
    // Детерминированный publicId вместо gen_random_uuid(): он же служит ключом идемпотентности.
    const publicId = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const existingOrder = await orders.findOne({ where: { publicId } });

    if (existingOrder) {
      continue;
    }

    const buyer = buyers[i % buyers.length];

    // Снапшот: телефон и адрес — НОВЫЕ строки, скопированные с профиля покупателя.
    const snapshotPhone = await phones.save(phones.create(phoneFor(100 + i)));
    const snapshotAddress = await addresses.save(
      addresses.create({
        addressLine: `Seed delivery ${i + 1}`,
        city: cities[i % cities.length],
        building: String(i + 1),
      }),
    );

    const recipient = await recipients.save(
      recipients.create({
        buyerId: buyer.id,
        fullName: `${buyer.firstName} ${buyer.lastName}`,
        phoneId: snapshotPhone.id,
        deliveryAddressId: snapshotAddress.id,
      }),
    );

    // 2 позиции на заказ; цены — снапшот цены оффера на момент заказа.
    const items = [offerRows[i % offerRows.length], offerRows[(i + 3) % offerRows.length]];
    const total = items.reduce((sum, offer) => sum + Number(offer.price), 0);

    const order = await orders.save(
      orders.create({
        publicId,
        orderRecipientId: recipient.id,
        status: statuses[i % statuses.length],
        totalAmount: total.toFixed(2),
        discountAmount: '0.00',
        currency: CurrencyEnum.UAH,
      }),
    );

    for (const [position, offer] of items.entries()) {
      await ensure(
        orderProducts,
        { orderId: order.id, productOfferId: offer.id } as FindOptionsWhere<OrderProduct>,
        {
          orderId: order.id,
          productOfferId: offer.id,
          quantity: position + 1,
          price: offer.price,
          discountPrice: offer.discountPrice,
        },
      );
    }
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    await seed();

    const counts = await Promise.all(
      ['Category', 'Brand', 'User', 'Product', 'ProductOffer', 'Order', 'OrderProduct'].map(
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
