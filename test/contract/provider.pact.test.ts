import { afterAll, beforeAll, describe, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { resolve } from 'node:path';
import { Verifier } from '@pact-foundation/pact';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { truncateAllTables } from '../support/isolation.js';
import {
  aBrandWithTranslation,
  aCatalogProduct,
  aCategoryWithTranslation,
  aUser,
} from '../support/builders.js';
import { CurrencyEnum } from '../../src/entities/enums.js';
import { ProductOffer } from '../../src/entities/product-offer.entity.js';

describe('Provider verification: marketplace-api', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let providerBaseUrl: string;

  beforeAll(async () => {
    const moduleRef = await NestFactory.create(AppModule, { logger: false });
    app = moduleRef;
    await app.listen(0);

    dataSource = app.get(DataSource);
    const address = app.getHttpServer().address();
    providerBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const stateHandlers: Record<string, () => Promise<undefined>> = {
    'product 1 exists in category "phones"': async () => {
      await truncateAllTables(dataSource);

      const category = await aCategoryWithTranslation(dataSource.manager, {
        slug: 'phones',
        name: 'Phones',
      });
      const brand = await aBrandWithTranslation(dataSource.manager, {
        slug: 'apple',
        name: 'Apple',
      });
      const product = await aCatalogProduct(dataSource.manager, {
        slug: 'iphone-15',
        title: 'iPhone 15',
        categoryId: category.id,
        brandId: brand.id,
      });
      const seller = await aUser(dataSource.manager);

      const offers = dataSource.manager.getRepository(ProductOffer);
      await offers.save(
        offers.create({
          productId: product.id,
          sellerId: seller.id,
          sku: 'IPHONE15-BASE',
          price: '999.99',
          currency: CurrencyEnum.USD,
          discountPrice: null,
          quantity: 5,
        }),
      );

      return undefined;
    },
  };

  it('satisfies the pact contract with marketplace-web', async () => {
    await new Verifier({
      provider: 'marketplace-api',
      providerBaseUrl,
      pactUrls: [
        resolve(process.cwd(), 'pacts', 'marketplace-web-marketplace-api.json'),
      ],
      stateHandlers,
      logLevel: 'warn',
    }).verifyProvider();
  });
});
