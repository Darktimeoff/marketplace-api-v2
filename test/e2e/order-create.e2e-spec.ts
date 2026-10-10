import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import { OrderLine } from '../../src/order/entity/order-line.entity.js';
import { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';
import { StockReservation } from '../../src/seller-offer/entity/stock-reservation.entity.js';
import { Account } from '../../src/account/entity/account.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { CountryCodeEnum, CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { aSellerOffer, aUser } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';
import { StockReservationStatusEnum } from '../../src/seller-offer/enum/stock-reservation-status.enum.js';
import { TransactionStatusEnum } from '../../src/account/enum/transaction-status.enum.js';
import { TransactionTypeEnum } from '../../src/account/enum/transaction-type.enum.js';

describe('Order create (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  async function fund(customerId: number, balance: string): Promise<void> {
    await dataSource.query(`INSERT INTO "Account" ("customerId", "balance") VALUES ($1, $2)`, [customerId, balance]);
  }

  function aBody(userId: number, items: { offerId: number; quantity: number }[]) {
    return {
      userId,
      recipient: {
        fullName: 'Jane Doe',
        phone: {
          countryCode: CountryCodeEnum.UA,
          rawNumber: '+380501234567',
          fullNumber: '+380501234567',
          nationalNumber: '0501234567',
        },
        address: { addressLine: 'Khreshchatyk St, 1', city: 'Kyiv', building: '1A' },
      },
      items,
      currency: CurrencyEnum.UAH,
    };
  }

  function placeOrder(body: object) {
    return request(app.getHttpServer()).post('/order').send(body);
  }

  function balanceOf(customerId: number): Promise<string | undefined> {
    return dataSource.getRepository(Account).findOneBy({ customerId }).then((account) => account?.balance);
  }

  function offerById(id: number): Promise<SellerOffer> {
    return dataSource.getRepository(SellerOffer).findOneByOrFail({ id });
  }

  function onlyOrder(): Promise<Order> {
    return dataSource.getRepository(Order).findOneOrFail({ where: {}, relations: { orderRecipient: true, lines: true } });
  }

  it('pays the order, snapshots the recipient, reserves stock and charges the user', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', discountPrice: '80.00', onHandQuantity: 5 });

    const response = await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 2 }])).expect(201);

    expect(response.body).toMatchObject({
      status: OrderStatusEnum.paid,
      totalAmount: '160.00',
      discountAmount: '40.00',
      currency: CurrencyEnum.UAH,
    });

    const order = await onlyOrder();
    expect(order).toMatchObject({ id: response.body.id, publicId: response.body.publicId, userId: buyer.id });
    expect(order.orderRecipient).toMatchObject({
      fullName: 'Jane Doe',
      phone: {
        countryCode: CountryCodeEnum.UA,
        rawNumber: '+380501234567',
        fullNumber: '+380501234567',
        nationalNumber: '0501234567',
      },
      address: { addressLine: 'Khreshchatyk St, 1', city: 'Kyiv', building: '1A' },
    });
    expect(order.lines).toEqual([
      expect.objectContaining({ offerId: offer.id, quantity: 2, unitPrice: '100.00', unitDiscountPrice: '80.00' }),
    ]);

    expect(await offerById(offer.id)).toMatchObject({ onHandQuantity: 5, reservedQuantity: 2 });
    expect(await dataSource.getRepository(StockReservation).findBy({ orderPublicId: order.publicId })).toEqual([
      expect.objectContaining({ offerId: offer.id, quantity: 2, status: StockReservationStatusEnum.RESERVED }),
    ]);

    expect(await balanceOf(buyer.id)).toBe('840.00');
    expect(await dataSource.getRepository(Transaction).findBy({ customerId: buyer.id })).toEqual([
      expect.objectContaining({ amount: '160.00', type: TransactionTypeEnum.PAYMENT, status: TransactionStatusEnum.SUCCESS }),
    ]);
  });

  it('sums several lines and stores a missing building as null', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const first = await aSellerOffer(dataSource.manager, { price: '50.00', onHandQuantity: 5 });
    const second = await aSellerOffer(dataSource.manager, { price: '30.00', discountPrice: '20.00', onHandQuantity: 5 });
    const body = aBody(buyer.id, [{ offerId: second.id, quantity: 3 }, { offerId: first.id, quantity: 1 }]);
    delete (body.recipient.address as { building?: string }).building;

    const response = await placeOrder(body).expect(201);

    expect(response.body).toMatchObject({ status: OrderStatusEnum.paid, totalAmount: '110.00', discountAmount: '30.00' });
    const order = await onlyOrder();
    expect(order.orderRecipient.address.building).toBeNull();
    expect(order.lines).toHaveLength(2);
    expect(await balanceOf(buyer.id)).toBe('890.00');
  });

  it('cancels the order when stock is insufficient and charges nothing', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 1 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 2 }])).expect(422);

    expect((await onlyOrder()).status).toBe(OrderStatusEnum.canceled);
    expect(await offerById(offer.id)).toMatchObject({ onHandQuantity: 1, reservedQuantity: 0 });
    expect(await dataSource.getRepository(StockReservation).count()).toBe(0);
    expect(await balanceOf(buyer.id)).toBe('1000.00');
    expect(await dataSource.getRepository(Transaction).count()).toBe(0);
  });

  it('marks the order failed_payment and releases the stock when the balance is too low', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '50.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(422);

    const order = await onlyOrder();
    expect(order.status).toBe(OrderStatusEnum.failed_payment);
    await vi.waitFor(async () => {
      expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
    });
    expect(await dataSource.getRepository(StockReservation).findBy({ orderPublicId: order.publicId })).toEqual([
      expect.objectContaining({ status: StockReservationStatusEnum.RELEASED }),
    ]);
    expect(await balanceOf(buyer.id)).toBe('50.00');
    expect(await dataSource.getRepository(Transaction).count()).toBe(0);
  });

  it('marks the order failed_payment when the user has no account', async () => {
    const buyer = await aUser(dataSource.manager);
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(422);

    expect((await onlyOrder()).status).toBe(OrderStatusEnum.failed_payment);
    await vi.waitFor(async () => {
      expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
    });
  });

  it('refunds the charge and releases the stock when the order fails after payment', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });
    await dataSource.query(`
      CREATE FUNCTION "testBlockPaid"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."status" = 'paid' THEN RAISE EXCEPTION 'paid is blocked'; END IF; RETURN NEW; END $$
    `);
    await dataSource.query(`CREATE TRIGGER "testBlockPaid" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION "testBlockPaid"()`);

    try {
      await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(500);
    } finally {
      await dataSource.query(`DROP TRIGGER "testBlockPaid" ON "Order"`);
      await dataSource.query(`DROP FUNCTION "testBlockPaid"()`);
    }

    expect((await onlyOrder()).status).toBe(OrderStatusEnum.canceled);
    await vi.waitFor(async () => {
      expect(await balanceOf(buyer.id)).toBe('1000.00');
      expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
    });
    const transactions = await dataSource.getRepository(Transaction).find({ where: { customerId: buyer.id }, order: { id: 'ASC' } });
    expect(transactions.map(({ type, amount, status }) => ({ type, amount, status }))).toEqual([
      { type: TransactionTypeEnum.PAYMENT, amount: '100.00', status: TransactionStatusEnum.SUCCESS },
      { type: TransactionTypeEnum.REFUND, amount: '100.00', status: TransactionStatusEnum.SUCCESS },
    ]);
  });

  it('returns 404 for an unknown offer and leaves nothing behind', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');

    await placeOrder(aBody(buyer.id, [{ offerId: 999999, quantity: 1 }])).expect(404);

    expect(await dataSource.getRepository(Order).count()).toBe(0);
    expect(await dataSource.getRepository(OrderRecipient).count()).toBe(0);
    expect(await dataSource.getRepository(OrderLine).count()).toBe(0);
  });

  it('sells the last unit only once under concurrent orders', async () => {
    const first = await aUser(dataSource.manager);
    const second = await aUser(dataSource.manager);
    await fund(first.id, '1000.00');
    await fund(second.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 1 });

    const responses = await Promise.all([
      placeOrder(aBody(first.id, [{ offerId: offer.id, quantity: 1 }])),
      placeOrder(aBody(second.id, [{ offerId: offer.id, quantity: 1 }])),
    ]);

    expect(responses.map((response) => response.status).toSorted()).toEqual([201, 422]);
    const statuses = (await dataSource.getRepository(Order).find()).map((order) => order.status).toSorted();
    expect(statuses).toEqual([OrderStatusEnum.canceled, OrderStatusEnum.paid].toSorted());
    expect(await offerById(offer.id)).toMatchObject({ onHandQuantity: 1, reservedQuantity: 1 });
  });

  describe('rejects an invalid body with 400 and creates nothing', () => {
    const cases: [string, (body: ReturnType<typeof aBody>) => unknown][] = [
      ['missing userId', (body) => ({ ...body, userId: undefined })],
      ['non-positive userId', (body) => ({ ...body, userId: 0 })],
      ['missing recipient', (body) => ({ ...body, recipient: undefined })],
      ['empty full name', (body) => ({ ...body, recipient: { ...body.recipient, fullName: '' } })],
      ['blank full name', (body) => ({ ...body, recipient: { ...body.recipient, fullName: '   ' } })],
      ['missing phone', (body) => ({ ...body, recipient: { ...body.recipient, phone: undefined } })],
      ['missing address', (body) => ({ ...body, recipient: { ...body.recipient, address: undefined } })],
      ['unknown country code', (body) => ({ ...body, recipient: { ...body.recipient, phone: { ...body.recipient.phone, countryCode: 'XX' } } })],
      ['phone not in E.164', (body) => ({ ...body, recipient: { ...body.recipient, phone: { ...body.recipient.phone, fullNumber: '0501234567' } } })],
      ['non-digit national number', (body) => ({ ...body, recipient: { ...body.recipient, phone: { ...body.recipient.phone, nationalNumber: '050-123' } } })],
      ['missing city', (body) => ({ ...body, recipient: { ...body.recipient, address: { addressLine: 'Khreshchatyk St, 1' } } })],
      ['address line too long', (body) => ({ ...body, recipient: { ...body.recipient, address: { ...body.recipient.address, addressLine: 'x'.repeat(256) } } })],
      ['empty items', (body) => ({ ...body, items: [] })],
      ['zero quantity', (body) => ({ ...body, items: [{ offerId: 1, quantity: 0 }] })],
      ['unknown currency', (body) => ({ ...body, currency: 'BTC' })],
      ['old recipient shape', (body) => ({ ...body, userId: undefined, recipient: { ...body.recipient, buyerId: 1, address: undefined, deliveryAddress: body.recipient.address } })],
    ];

    it.each(cases)('%s', async (_, mutate) => {
      await placeOrder(mutate(aBody(1, [{ offerId: 1, quantity: 1 }])) as object).expect(400);

      expect(await dataSource.getRepository(Order).count()).toBe(0);
      expect(await dataSource.getRepository(OrderRecipient).count()).toBe(0);
    });
  });
});
