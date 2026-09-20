import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Phone } from '../../src/entities/phone.entity.js';
import { DeliveryAddress } from '../../src/entities/delivery-address.entity.js';
import { Identity } from '../../src/entities/identity.entity.js';
import { User } from '../../src/entities/user.entity.js';
import { Brand } from '../../src/entities/brand.entity.js';
import { Category } from '../../src/entities/category.entity.js';
import { Product } from '../../src/entities/product.entity.js';
import { ProductOffer } from '../../src/entities/product-offer.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import {
  CountryCodeEnum,
  CurrencyEnum,
  RoleEnum,
} from '../../src/entities/enums.js';
import type { BackgroundJobCreateEntityInterface } from '../../src/background-job/entity/background-job.entity.js';
import { BackgroundJobTypeEnum } from '../../src/entities/enums.js';

let counter = 0;
function nextSeq(): number {
  counter += 1;
  return counter;
}

export function aPhone(
  manager: EntityManager,
  overrides: Partial<Phone> = {},
): Promise<Phone> {
  const seq = nextSeq();
  const repository = manager.getRepository(Phone);

  return repository.save(
    repository.create({
      countryCode: CountryCodeEnum.UA,
      rawNumber: `+38050${String(seq).padStart(7, '0')}`,
      fullNumber: `+38050${String(seq).padStart(7, '0')}`,
      nationalNumber: `050${String(seq).padStart(7, '0')}`,
      ...overrides,
    }),
  );
}

export function aDeliveryAddress(
  manager: EntityManager,
  overrides: Partial<DeliveryAddress> = {},
): Promise<DeliveryAddress> {
  const repository = manager.getRepository(DeliveryAddress);

  return repository.save(
    repository.create({
      addressLine: 'Khreshchatyk St, 1',
      city: 'Kyiv',
      building: '1A',
      ...overrides,
    }),
  );
}

export async function aUser(
  manager: EntityManager,
  overrides: Partial<User> = {},
): Promise<User> {
  const seq = nextSeq();
  const identities = manager.getRepository(Identity);
  const users = manager.getRepository(User);

  const identity = await identities.save(
    identities.create({
      email: `buyer-${seq}@example.test`,
      passwordHash: 'not-a-real-hash',
      role: RoleEnum.user,
    }),
  );

  return users.save(
    users.create({
      identityId: identity.id,
      firstName: 'Test',
      lastName: `User${seq}`,
      ...overrides,
    }),
  );
}

export async function anOrderRecipient(
  manager: EntityManager,
  overrides: Partial<
    Pick<
      OrderRecipient,
      'buyerId' | 'fullName' | 'phoneId' | 'deliveryAddressId'
    >
  > = {},
): Promise<OrderRecipient> {
  const [buyer, phone, deliveryAddress] = await Promise.all([
    overrides.buyerId === undefined ? aUser(manager) : undefined,
    overrides.phoneId === undefined ? aPhone(manager) : undefined,
    overrides.deliveryAddressId === undefined
      ? aDeliveryAddress(manager)
      : undefined,
  ]);

  const recipients = manager.getRepository(OrderRecipient);

  return recipients.save(
    recipients.create({
      buyerId: overrides.buyerId ?? buyer!.id,
      fullName: 'Test Recipient',
      phoneId: overrides.phoneId ?? phone!.id,
      deliveryAddressId: overrides.deliveryAddressId ?? deliveryAddress!.id,
    }),
  );
}

export async function aProductOffer(
  manager: EntityManager,
  overrides: Partial<
    Pick<
      ProductOffer,
      | 'sellerId'
      | 'productId'
      | 'sku'
      | 'price'
      | 'discountPrice'
      | 'quantity'
      | 'currency'
    >
  > = {},
): Promise<ProductOffer> {
  const seq = nextSeq();
  const brands = manager.getRepository(Brand);
  const categories = manager.getRepository(Category);
  const products = manager.getRepository(Product);
  const offers = manager.getRepository(ProductOffer);

  const [seller, brand, category] = await Promise.all([
    overrides.sellerId === undefined ? aUser(manager) : undefined,
    brands.save(brands.create({ slug: `brand-${seq}` })),
    categories.save(categories.create({ slug: `category-${seq}` })),
  ]);

  const productId =
    overrides.productId ??
    (
      await products.save(
        products.create({
          categoryId: category.id,
          brandId: brand.id,
          slug: `product-${seq}`,
        }),
      )
    ).id;

  return offers.save(
    offers.create({
      productId,
      sellerId: overrides.sellerId ?? seller!.id,
      sku: overrides.sku ?? `SKU-${seq}`,
      price: overrides.price ?? '100.00',
      currency: overrides.currency ?? CurrencyEnum.UAH,
      discountPrice: overrides.discountPrice ?? null,
      quantity: overrides.quantity ?? 10,
    }),
  );
}

export function aBackgroundJobInput(
  overrides: Partial<BackgroundJobCreateEntityInterface> = {},
): BackgroundJobCreateEntityInterface {
  return {
    type: BackgroundJobTypeEnum.ORDER,
    dedupeKey: `job-${randomUUID()}`,
    payload: {},
    orderId: null,
    ...overrides,
  };
}
