import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Phone } from '../../src/phone/entity/phone.entity.js';
import { DeliveryAddress } from '../../src/delivery-address/entity/delivery-address.entity.js';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { User } from '../../src/user/entity/user.entity.js';
import { Brand } from '../../src/brand/entity/brand.entity.js';
import { BrandTranslation } from '../../src/brand/entity/brand-translation.entity.js';
import { Category } from '../../src/category/entity/category.entity.js';
import { CategoryTranslation } from '../../src/category/entity/category-translation.entity.js';
import { Product } from '../../src/product/entity/product.entity.js';
import { ProductTranslation } from '../../src/product/entity/product-translation.entity.js';
import { ProductVariant } from '../../src/product-variant/entity/product-variant.entity.js';
import { Seller } from '../../src/seller/entity/seller.entity.js';
import { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import {
  CountryCodeEnum,
  CurrencyEnum,
  LanguageEnum,
  RoleEnum,
} from '../../src/generic/enum/enums.js';
import type { BackgroundJobCreateEntityInterface } from '../../src/background-job/entity/background-job.entity.js';
import { BackgroundJobTypeEnum } from '../../src/generic/enum/enums.js';

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

export async function aSellerOffer(
  manager: EntityManager,
  overrides: Partial<
    Pick<
      SellerOffer,
      | 'sellerId'
      | 'variantId'
      | 'sellerSku'
      | 'price'
      | 'discountPrice'
      | 'quantity'
      | 'currency'
    >
  > = {},
): Promise<SellerOffer> {
  const seq = nextSeq();
  const brands = manager.getRepository(Brand);
  const categories = manager.getRepository(Category);
  const products = manager.getRepository(Product);
  const variants = manager.getRepository(ProductVariant);
  const sellers = manager.getRepository(Seller);
  const offers = manager.getRepository(SellerOffer);

  let variantId = overrides.variantId;

  if (variantId === undefined) {
    const [brand, category] = await Promise.all([
      brands.save(brands.create({ slug: `brand-${seq}` })),
      categories.save(categories.create({ slug: `category-${seq}` })),
    ]);

    const product = await products.save(
      products.create({ categoryId: category.id, brandId: brand.id }),
    );

    const variant = await variants.save(
      variants.create({
        productId: product.id,
        sku: `sku-${seq}`,
        slug: `product-${seq}`,
        barcode: null,
      }),
    );

    variantId = variant.id;
  }

  let sellerId = overrides.sellerId;

  if (sellerId === undefined) {
    const sellerUser = await aUser(manager);
    const seller = await sellers.save(
      sellers.create({ userId: sellerUser.id }),
    );

    sellerId = seller.id;
  }

  return offers.save(
    offers.create({
      variantId,
      sellerId,
      sellerSku: overrides.sellerSku ?? `SKU-${seq}`,
      price: overrides.price ?? '100.00',
      currency: overrides.currency ?? CurrencyEnum.UAH,
      discountPrice: overrides.discountPrice ?? null,
      quantity: overrides.quantity ?? 10,
    }),
  );
}

export async function aCategoryWithTranslation(
  manager: EntityManager,
  options: { slug: string; name: string; parentCategoryId?: number | null },
): Promise<Category> {
  const categories = manager.getRepository(Category);
  const category = await categories.save(
    categories.create({
      slug: options.slug,
      parentCategoryId: options.parentCategoryId ?? null,
    }),
  );

  const translations = manager.getRepository(CategoryTranslation);
  await translations.save(
    translations.create({
      categoryId: category.id,
      name: options.name,
      language: LanguageEnum.en,
    }),
  );

  return category;
}

export async function aBrandWithTranslation(
  manager: EntityManager,
  options: { slug: string; name: string },
): Promise<Brand> {
  const brands = manager.getRepository(Brand);
  const brand = await brands.save(brands.create({ slug: options.slug }));

  const translations = manager.getRepository(BrandTranslation);
  await translations.save(
    translations.create({
      brandId: brand.id,
      name: options.name,
      language: LanguageEnum.en,
    }),
  );

  return brand;
}

export async function aCatalogProduct(
  manager: EntityManager,
  options: { slug: string; title: string; categoryId: number; brandId: number },
): Promise<{ product: Product; variant: ProductVariant }> {
  const products = manager.getRepository(Product);
  const product = await products.save(
    products.create({
      categoryId: options.categoryId,
      brandId: options.brandId,
    }),
  );

  const translations = manager.getRepository(ProductTranslation);
  await translations.save(
    translations.create({
      productId: product.id,
      title: options.title,
      language: LanguageEnum.en,
    }),
  );

  const variants = manager.getRepository(ProductVariant);
  const variant = await variants.save(
    variants.create({
      productId: product.id,
      sku: options.slug,
      slug: options.slug,
      barcode: null,
    }),
  );

  return { product, variant };
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
