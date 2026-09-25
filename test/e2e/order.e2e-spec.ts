import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import {
  CountryCodeEnum,
  CurrencyEnum,
  TransactionStatusEnum,
  TransactionTypeEnum,
} from '../../src/generic/enum/enums.js';
import { aSellerOffer, aUser } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

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

  async function fundBuyer(userId: number, amount: string): Promise<void> {
    const transactions = dataSource.manager.getRepository(Transaction);
    await transactions.save(
      transactions.create({
        userId,
        amount,
        type: TransactionTypeEnum.DEPOSIT,
        status: TransactionStatusEnum.SUCCESS,
      }),
    );
  }

  it('creates an order and reads it back over HTTP', async () => {
    const buyer = await aUser(dataSource.manager);
    await fundBuyer(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, {
      price: '50.00',
      quantity: 5,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/order')
      .send({
        recipient: {
          buyerId: buyer.id,
          fullName: 'Jane Doe',
          phone: {
            countryCode: CountryCodeEnum.UA,
            rawNumber: '+380501234567',
            fullNumber: '+380501234567',
            nationalNumber: '0501234567',
          },
          deliveryAddress: {
            addressLine: 'Khreshchatyk St, 1',
            city: 'Kyiv',
          },
        },
        items: [{ offerId: offer.id, quantity: 2 }],
        currency: CurrencyEnum.UAH,
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      status: 'created',
      totalAmount: '100.00',
      currency: CurrencyEnum.UAH,
    });

    const orderId = createResponse.body.id;

    const readResponse = await request(app.getHttpServer())
      .get(`/order/${orderId}`)
      .expect(200);

    expect(readResponse.body).toMatchObject({
      id: orderId,
      publicId: createResponse.body.publicId,
      status: 'created',
      totalAmount: '100.00',
    });
  });

  it('rejects order creation with an invalid body (ValidationPipe 400)', async () => {
    await request(app.getHttpServer())
      .post('/order')
      .send({ recipient: {}, items: [] })
      .expect(400);
  });

  it('returns 404 for a non-existent order id', async () => {
    await request(app.getHttpServer()).get('/order/999999').expect(404);
  });
});
