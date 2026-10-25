import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { CountryCodeEnum, CurrencyEnum } from '@marketplace/contracts-core';
import { aSellerOffer } from '../support/builders.js';
import { aBuyer, type TestBuyerInterface } from '../support/buyer.js';
import { RoleEnum } from '../../src/identity/enum/role.enum.js';
import { truncateAllTables } from '../support/isolation.js';
import { TransactionStatusEnum } from '../../src/account/enum/transaction-status.enum.js';
import { TransactionTypeEnum } from '../../src/account/enum/transaction-type.enum.js';

describe('Order (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function fundBuyer(customerId: number, amount: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO "Account" ("customerId", "balance") VALUES ($1, $2)
       ON CONFLICT ("customerId") DO UPDATE SET "balance" = "Account"."balance" + EXCLUDED."balance"`,
      [customerId, amount],
    );
    const transactions = dataSource.manager.getRepository(Transaction);
    await transactions.save(
      transactions.create({
        customerId,
        amount,
        type: TransactionTypeEnum.DEPOSIT,
        status: TransactionStatusEnum.SUCCESS,
      }),
    );
  }

  function get(path: string, as?: TestBuyerInterface) {
    const call = request(app.getHttpServer()).get(path);
    return as ? call.set('Authorization', `Bearer ${as.token}`) : call;
  }

  async function aPlacedOrder(owner: TestBuyerInterface): Promise<number> {
    await fundBuyer(owner.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '50.00', onHandQuantity: 5 });
    const response = await request(app.getHttpServer())
      .post('/order')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        recipient: {
          fullName: 'Jane Doe',
          phone: { countryCode: CountryCodeEnum.UA, rawNumber: '+380501234567', fullNumber: '+380501234567', nationalNumber: '0501234567' },
          address: { addressLine: 'Khreshchatyk St, 1', city: 'Kyiv' },
        },
        items: [{ offerId: offer.id, quantity: 1 }],
        currency: CurrencyEnum.UAH,
      })
      .expect(202);
    return response.body.id;
  }

  it('creates an order and reads it back over HTTP', async () => {
    const buyer = await aBuyer(app, dataSource);
    await fundBuyer(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, {
      price: '50.00',
      onHandQuantity: 5,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/order')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        recipient: {
          fullName: 'Jane Doe',
          phone: {
            countryCode: CountryCodeEnum.UA,
            rawNumber: '+380501234567',
            fullNumber: '+380501234567',
            nationalNumber: '0501234567',
          },
          address: {
            addressLine: 'Khreshchatyk St, 1',
            city: 'Kyiv',
          },
        },
        items: [{ offerId: offer.id, quantity: 2 }],
        currency: CurrencyEnum.UAH,
      })
      .expect(202);

    expect(createResponse.body).toMatchObject({
      status: 'pending_payment',
      totalAmount: '100.00',
      currency: CurrencyEnum.UAH,
    });

    const orderId = createResponse.body.id;

    const readResponse = await vi.waitFor(async () => {
      const response = await get(`/order/${orderId}`, buyer).expect(200);
      if (response.body.status === 'pending_payment') throw new Error('order not settled yet');
      return response;
    }, { timeout: 15000, interval: 100 });

    expect(readResponse.body).toMatchObject({
      id: orderId,
      publicId: createResponse.body.publicId,
      status: 'paid',
      totalAmount: '100.00',
    });
  });

  it('rejects order creation with an invalid body (ValidationPipe 400)', async () => {
    await request(app.getHttpServer())
      .post('/order')
      .set('Authorization', `Bearer ${(await aBuyer(app, dataSource)).token}`)
      .send({ recipient: {}, items: [] })
      .expect(400);
  });

  it('returns 404 for a non-existent order id', async () => {
    await get('/order/999999', await aBuyer(app, dataSource)).expect(404);
  });

  describe('ownership', () => {
    it('answers 401 without a token', async () => {
      const orderId = await aPlacedOrder(await aBuyer(app, dataSource));

      await get(`/order/${orderId}`).expect(401);
    });

    it('answers 200 to the owner and 403 to another buyer', async () => {
      const owner = await aBuyer(app, dataSource);
      const stranger = await aBuyer(app, dataSource);
      const orderId = await aPlacedOrder(owner);

      await get(`/order/${orderId}`, owner).expect(200);
      const forbidden = await get(`/order/${orderId}`, stranger).expect(403);
      expect(forbidden.headers['www-authenticate']).toBeUndefined();
    });

    it('lets an admin read any order', async () => {
      const orderId = await aPlacedOrder(await aBuyer(app, dataSource));

      await get(`/order/${orderId}`, await aBuyer(app, dataSource, RoleEnum.admin)).expect(200);
    });

    it('applies ownership to a cached order too', async () => {
      const owner = await aBuyer(app, dataSource);
      const stranger = await aBuyer(app, dataSource);
      const orderId = await aPlacedOrder(owner);
      await get(`/order/${orderId}`, owner).expect(200);

      await get(`/order/${orderId}`, stranger).expect(403);
    });
  });
});
