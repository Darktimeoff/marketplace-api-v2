import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import {
  Brand,
  Category,
  CountryCodeEnum,
  CurrencyEnum,
  Identity,
  Phone,
  Product,
  ProductOffer,
  RoleEnum,
  Transaction,
  TransactionStatusEnum,
  TransactionTypeEnum,
  User,
} from '../entities/index.js';

export const DEMO_SLUG = 'demo-concurrency';
export const DEMO_SELLER_EMAIL = 'demo-seller@concurrency.local';
export const RACE_OFFER_SKU = 'DEMO-RACE-SKU';
export const RETRY_OFFER_SKU = 'DEMO-RETRY-SKU';
export const WORKERS_DEDUPE_PREFIX = 'demo:workers:';

export const DEMO_OFFER_PRICE = '100.00';

async function ensure<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
  data: DeepPartial<T>,
): Promise<T> {
  const existing = await repo.findOne({ where });

  return existing ?? (await repo.save(repo.create(data)));
}

function phoneFor(index: number) {
  const national = String(900000000 + index);

  return {
    countryCode: CountryCodeEnum.UA,
    rawNumber: `0${national}`,
    fullNumber: `+380${national}`,
    nationalNumber: national,
  };
}

async function ensureUser(
  manager: EntityManager,
  email: string,
  role: RoleEnum,
  phoneIndex: number,
  firstName: string,
): Promise<User> {
  const identities = manager.getRepository(Identity);
  const users = manager.getRepository(User);
  const phones = manager.getRepository(Phone);

  let identity = await identities.findOne({ where: { email } });

  if (!identity) {
    const phone = await phones.save(phones.create(phoneFor(phoneIndex)));

    identity = await identities.save(
      identities.create({
        email,
        phoneId: phone.id,
        passwordHash: `$2b$10$demo.concurrency.hash.${phoneIndex}`,
        role,
      }),
    );
  }

  return ensure(users, { identityId: identity.id } as FindOptionsWhere<User>, {
    identityId: identity.id,
    firstName,
    lastName: 'Demo',
  });
}

export async function ensureDemoOffer(
  dataSource: DataSource,
  sku: string,
  quantity: number,
): Promise<ProductOffer> {
  return dataSource.transaction(async (manager) => {
    const seller = await ensureUser(manager, DEMO_SELLER_EMAIL, RoleEnum.seller, 0, 'DemoSeller');

    const category = await ensure(
      manager.getRepository(Category),
      { slug: DEMO_SLUG } as FindOptionsWhere<Category>,
      { slug: DEMO_SLUG, parentCategoryId: null },
    );
    const brand = await ensure(
      manager.getRepository(Brand),
      { slug: DEMO_SLUG } as FindOptionsWhere<Brand>,
      { slug: DEMO_SLUG },
    );
    const product = await ensure(
      manager.getRepository(Product),
      { slug: DEMO_SLUG } as FindOptionsWhere<Product>,
      { slug: DEMO_SLUG, categoryId: category.id, brandId: brand.id },
    );

    const offers = manager.getRepository(ProductOffer);

    await ensure(offers, { sellerId: seller.id, sku } as FindOptionsWhere<ProductOffer>, {
      sellerId: seller.id,
      sku,
      productId: product.id,
      price: DEMO_OFFER_PRICE,
      currency: CurrencyEnum.UAH,
      discountPrice: null,
      quantity,
    });

    await offers.update({ sellerId: seller.id, sku }, { quantity });

    return offers.findOneByOrFail({ sellerId: seller.id, sku });
  });
}

export async function ensureDemoBuyers(
  dataSource: DataSource,
  count: number,
  minBalance: number,
): Promise<User[]> {
  const buyers: User[] = [];

  await dataSource.transaction(async (manager) => {
    for (let index = 1; index <= count; index++) {
      buyers.push(
        await ensureUser(
          manager,
          `demo-buyer-${index}@concurrency.local`,
          RoleEnum.user,
          index,
          `DemoBuyer${index}`,
        ),
      );
    }

    const ids = buyers.map((buyer) => buyer.id);

    const balances: { userId: number; balance: string }[] = await manager.query(
      `SELECT u.id AS "userId",
              COALESCE(SUM(CASE WHEN t."type" = 'DEPOSIT' THEN t."amount" ELSE -t."amount" END), 0) AS balance
         FROM "User" u
         LEFT JOIN "Transaction" t ON t."userId" = u.id AND t."status" = 'SUCCESS'
        WHERE u.id = ANY($1::int[])
        GROUP BY u.id`,
      [ids],
    );

    const transactions = manager.getRepository(Transaction);

    for (const { userId, balance } of balances) {
      const missing = minBalance - Number(balance);

      if (missing > 0) {
        await transactions.save(
          transactions.create({
            userId,
            amount: missing.toFixed(2),
            type: TransactionTypeEnum.DEPOSIT,
            status: TransactionStatusEnum.SUCCESS,
          }),
        );
      }
    }
  });

  return buyers;
}
