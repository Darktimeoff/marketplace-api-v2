import { afterAll, beforeAll, describe, it } from 'vitest';
import { execSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
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
import { CurrencyEnum } from '../../src/generic/enum/enums.js';
import { Seller } from '../../src/seller/entity/seller.entity.js';
import { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';

// Non-secret by design: local docker-compose always exposes the broker on
// this loopback address. CI/staging point PACT_BROKER_URL at the real broker.
const DEFAULT_BROKER_URL = 'http://127.0.0.1:9292';

// OSS Pact Broker only supports HTTP Basic Auth (no bearer-token endpoint),
// so PACT_BROKER_TOKEN is the Basic Auth password; the username is a fixed,
// non-secret constant, same way the broker's own docker-compose service is set up.
const PACT_BROKER_USERNAME = 'ci';

function providerVersion(): string {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  return execSync('git rev-parse HEAD').toString().trim();
}

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
      const { variant } = await aCatalogProduct(dataSource.manager, {
        slug: 'iphone-15',
        title: 'iPhone 15',
        categoryId: category.id,
        brandId: brand.id,
      });
      const sellerUser = await aUser(dataSource.manager);
      const sellers = dataSource.manager.getRepository(Seller);
      const seller = await sellers.save(
        sellers.create({ userId: sellerUser.id }),
      );

      const offers = dataSource.manager.getRepository(SellerOffer);
      await offers.save(
        offers.create({
          variantId: variant.id,
          sellerId: seller.id,
          sellerSku: 'IPHONE15-BASE',
          price: '999.99',
          currency: CurrencyEnum.USD,
          discountPrice: null,
          quantity: 5,
        }),
      );

      return undefined;
    },
  };

  it('satisfies the pact contract published by marketplace-web in the broker', async () => {
    await new Verifier({
      provider: 'marketplace-api',
      providerBaseUrl,
      pactBrokerUrl: process.env.PACT_BROKER_URL ?? DEFAULT_BROKER_URL,
      pactBrokerUsername: PACT_BROKER_USERNAME,
      pactBrokerPassword: process.env.PACT_BROKER_TOKEN,
      consumerVersionSelectors: [{ latest: true }],
      publishVerificationResult: true,
      providerVersion: providerVersion(),
      stateHandlers,
      logLevel: 'warn',
    }).verifyProvider();
  });
});
