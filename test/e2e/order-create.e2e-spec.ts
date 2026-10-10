import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ApplicationFailure } from '@temporalio/activity';
import { AppModule } from '../../src/app.module.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import { OrderLine } from '../../src/order/entity/order-line.entity.js';
import { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';
import { StockReservation } from '../../src/seller-offer/entity/stock-reservation.entity.js';
import { Account } from '../../src/account/entity/account.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { OrderOutbox } from '../../src/order/entity/order-outbox.entity.js';
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
    vi.restoreAllMocks();
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

  function placeOrder(body: object, idempotencyKey?: string) {
    const post = request(app.getHttpServer()).post('/order');
    return (idempotencyKey ? post.set('Idempotency-Key', idempotencyKey) : post).send(body);
  }

  function balanceOf(customerId: number): Promise<string | undefined> {
    return dataSource.getRepository(Account).findOneBy({ customerId }).then((account) => account?.balance);
  }

  function offerById(id: number): Promise<SellerOffer> {
    return dataSource.getRepository(SellerOffer).findOneByOrFail({ id });
  }

  function outboxRows(): Promise<OrderOutbox[]> {
    return dataSource.getRepository(OrderOutbox).find({ order: { type: 'ASC' } });
  }

  async function publishedOutboxRows(count: number): Promise<OrderOutbox[]> {
    return vi.waitFor(async () => {
      const rows = await outboxRows();
      if (rows.length !== count || rows.some((row) => row.publishedAt === null)) throw new Error('outbox not published yet');
      return rows;
    }, { timeout: 15000, interval: 100 });
  }

  async function kafkaEvent(topic: string, id: string): Promise<Record<string, unknown>> {
    const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: [process.env.KAFKA_BROKERS as string], logLevel: KafkaJS.logLevel.NOTHING } });
    const consumer = kafka.consumer({ kafkaJS: { groupId: `order-create-test-${randomUUID()}`, fromBeginning: true } });
    const received: Record<string, unknown>[] = [];
    await consumer.connect();
    await consumer.subscribe({ topic });
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          received.push(JSON.parse(message.value?.toString() ?? ''));
        } catch {
          return;
        }
      },
    });

    try {
      return await vi.waitFor(() => {
        const event = received.find((candidate) => candidate.id === id);
        if (!event) throw new Error(`no event ${id} on ${topic} yet`);
        return event;
      }, { timeout: 15000, interval: 100 });
    } finally {
      await consumer.disconnect();
    }
  }

  function onlyOrder(): Promise<Order> {
    return dataSource.getRepository(Order).findOneOrFail({ where: {}, relations: { orderRecipient: true, lines: true } });
  }

  async function settledOrders(count: number): Promise<Order[]> {
    return vi.waitFor(async () => {
      const orders = await dataSource.getRepository(Order).find({ relations: { orderRecipient: true, lines: true }, order: { id: 'ASC' } });
      if (orders.length !== count || orders.some((order) => order.status === OrderStatusEnum.pending_payment)) throw new Error('orders not settled yet');
      return orders;
    }, { timeout: 15000, interval: 100 });
  }

  async function settledOrder(): Promise<Order> {
    const [order] = await settledOrders(1);
    return order;
  }

  it('pays the order, snapshots the recipient, reserves stock and charges the user', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', discountPrice: '80.00', onHandQuantity: 5 });

    const response = await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 2 }])).expect(202);

    expect(response.body).toMatchObject({
      status: OrderStatusEnum.pending_payment,
      totalAmount: '160.00',
      discountAmount: '40.00',
      currency: CurrencyEnum.UAH,
    });

    const order = await settledOrder();
    expect(order).toMatchObject({ id: response.body.id, publicId: response.body.publicId, userId: buyer.id, status: OrderStatusEnum.paid });
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

    const rows = await publishedOutboxRows(2);
    expect(rows.map(({ type }) => type)).toEqual(['order.created', 'order.paid']);
    expect(rows[0].payload).toEqual({
      orderId: order.id,
      orderPublicId: order.publicId,
      userId: buyer.id,
      totalAmount: '160.00',
      discountAmount: '40.00',
      currency: CurrencyEnum.UAH,
      createdAt: order.createdAt.toISOString(),
    });
    const paidRow = rows[1];
    expect(paidRow).toMatchObject({ topic: 'order.events', type: 'order.paid', aggregateId: order.publicId, attempts: 0 });
    const event = await kafkaEvent('order.events', paidRow.id);
    expect(event).toEqual({
      specversion: '1.0',
      id: paidRow.id,
      source: '/order-service',
      type: 'order.paid',
      time: paidRow.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: order.publicId,
      correlationid: order.publicId,
      data: {
        orderId: order.id,
        orderPublicId: order.publicId,
        userId: buyer.id,
        totalAmount: '160.00',
        discountAmount: '40.00',
        currency: CurrencyEnum.UAH,
        lines: [{ offerId: offer.id, quantity: 2, unitPrice: '100.00', unitDiscountPrice: '80.00' }],
        paidAt: expect.any(String),
      },
    });
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

    const response = await placeOrder(body).expect(202);

    expect(response.body).toMatchObject({ status: OrderStatusEnum.pending_payment, totalAmount: '110.00', discountAmount: '30.00' });
    const order = await settledOrder();
    expect(order.status).toBe(OrderStatusEnum.paid);
    expect(order.orderRecipient.address.building).toBeNull();
    expect(order.lines).toHaveLength(2);
    expect(await balanceOf(buyer.id)).toBe('890.00');
  });

  it('cancels the order when stock is insufficient and charges nothing', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 1 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 2 }])).expect(202);

    expect((await settledOrder()).status).toBe(OrderStatusEnum.canceled);
    expect(await offerById(offer.id)).toMatchObject({ onHandQuantity: 1, reservedQuantity: 0 });
    expect(await dataSource.getRepository(StockReservation).count()).toBe(0);
    expect(await balanceOf(buyer.id)).toBe('1000.00');
    expect(await dataSource.getRepository(Transaction).count()).toBe(0);
    const order = await onlyOrder();
    expect(await publishedOutboxRows(2)).toEqual([
      expect.objectContaining({ type: 'order.created' }),
      expect.objectContaining({ type: 'order.failed', payload: expect.objectContaining({ orderId: order.id, status: 'canceled', reason: 'insufficient_stock' }) }),
    ]);
  });

  it('marks the order failed_payment and releases the stock when the balance is too low', async () => {
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '50.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(202);

    const order = await settledOrder();
    expect(order.status).toBe(OrderStatusEnum.failed_payment);
    expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
    expect(await dataSource.getRepository(StockReservation).findBy({ orderPublicId: order.publicId })).toEqual([
      expect.objectContaining({ status: StockReservationStatusEnum.RELEASED }),
    ]);
    expect(await balanceOf(buyer.id)).toBe('50.00');
    expect(await dataSource.getRepository(Transaction).count()).toBe(0);
    expect(await publishedOutboxRows(2)).toEqual([
      expect.objectContaining({ type: 'order.created' }),
      expect.objectContaining({ type: 'order.failed', payload: expect.objectContaining({ status: 'failed_payment', reason: 'payment_rejected' }) }),
    ]);
  });

  it('retries the stock release when its first request fails', async () => {
    const amqpConnection = app.get(AmqpConnection);
    const send = amqpConnection.request.bind(amqpConnection);
    let refused = 0;
    vi.spyOn(amqpConnection, 'request').mockImplementation(async (options) => {
      if (options.routingKey === 'seller-offer.stock.release' && refused === 0) {
        refused += 1;
        throw new Error('broker down');
      }
      return send(options);
    });
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '50.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(202);

    expect((await settledOrder()).status).toBe(OrderStatusEnum.failed_payment);
    expect(refused).toBe(1);
    expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
  });

  it('marks the order failed_payment when the user has no account', async () => {
    const buyer = await aUser(dataSource.manager);
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(202);

    expect((await settledOrder()).status).toBe(OrderStatusEnum.failed_payment);
    expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
  });

  it('refunds the charge and releases the stock when the charge fails after it was applied', async () => {
    const amqpConnection = app.get(AmqpConnection);
    const send = amqpConnection.request.bind(amqpConnection);
    vi.spyOn(amqpConnection, 'request').mockImplementation(async (options) => {
      const reply = await send(options);
      if (options.routingKey === 'account.customer.charge') {
        throw ApplicationFailure.nonRetryable('reply lost');
      }
      return reply;
    });
    const buyer = await aUser(dataSource.manager);
    await fund(buyer.id, '1000.00');
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }])).expect(202);

    const order = await settledOrder();
    expect(order.status).toBe(OrderStatusEnum.canceled);
    expect(await balanceOf(buyer.id)).toBe('1000.00');
    expect(await offerById(offer.id)).toMatchObject({ reservedQuantity: 0 });
    const transactions = await dataSource.getRepository(Transaction).find({ where: { customerId: buyer.id }, order: { id: 'ASC' } });
    expect(transactions.map(({ type, amount, status }) => ({ type, amount, status }))).toEqual([
      { type: TransactionTypeEnum.PAYMENT, amount: '100.00', status: TransactionStatusEnum.SUCCESS },
      { type: TransactionTypeEnum.REFUND, amount: '100.00', status: TransactionStatusEnum.SUCCESS },
    ]);
    expect(await publishedOutboxRows(2)).toEqual([
      expect.objectContaining({ type: 'order.created' }),
      expect.objectContaining({ type: 'order.failed', payload: expect.objectContaining({ orderId: order.id, status: 'canceled', reason: 'error' }) }),
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

    expect(responses.map((response) => response.status)).toEqual([202, 202]);
    const statuses = (await settledOrders(2)).map((order) => order.status).toSorted();
    expect(statuses).toEqual([OrderStatusEnum.canceled, OrderStatusEnum.paid].toSorted());
    expect(await offerById(offer.id)).toMatchObject({ onHandQuantity: 1, reservedQuantity: 1 });
  });

  describe('Idempotency-Key', () => {
    it('places one order for concurrent requests with the same key', async () => {
      const buyer = await aUser(dataSource.manager);
      await fund(buyer.id, '1000.00');
      const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });
      const key = randomUUID();
      const body = aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }]);

      const responses = await Promise.all([placeOrder(body, key), placeOrder(body, key)]);

      expect(responses.map(({ status }) => status)).toEqual([202, 202]);
      expect(responses[0].body.publicId).toBe(responses[1].body.publicId);
      const [order] = await settledOrders(1);
      expect(order).toMatchObject({ publicId: responses[0].body.publicId, idempotencyKey: key, status: OrderStatusEnum.paid });
      expect(await dataSource.getRepository(OrderRecipient).count()).toBe(1);
      expect(await balanceOf(buyer.id)).toBe('900.00');
      expect((await publishedOutboxRows(2)).map(({ type }) => type)).toEqual(['order.created', 'order.paid']);
    });

    it('returns the same order when the request is retried after it settled', async () => {
      const buyer = await aUser(dataSource.manager);
      await fund(buyer.id, '1000.00');
      const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });
      const key = randomUUID();
      const body = aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }]);

      const first = await placeOrder(body, key).expect(202);
      await settledOrders(1);
      const retry = await placeOrder(body, key).expect(202);

      expect(retry.body).toMatchObject({ id: first.body.id, publicId: first.body.publicId, status: OrderStatusEnum.paid });
      expect(await dataSource.getRepository(Order).count()).toBe(1);
      expect(await balanceOf(buyer.id)).toBe('900.00');
    });

    it('places two orders for the same body with different keys or without a key', async () => {
      const buyer = await aUser(dataSource.manager);
      await fund(buyer.id, '1000.00');
      const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });
      const body = aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }]);

      await placeOrder(body, randomUUID()).expect(202);
      await placeOrder(body, randomUUID()).expect(202);
      await placeOrder(body).expect(202);
      await placeOrder(body).expect(202);

      expect((await settledOrders(4)).map(({ status }) => status)).toEqual(Array(4).fill(OrderStatusEnum.paid));
    });

    it('scopes the key to the user', async () => {
      const first = await aUser(dataSource.manager);
      const second = await aUser(dataSource.manager);
      await fund(first.id, '1000.00');
      await fund(second.id, '1000.00');
      const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });
      const key = randomUUID();

      await placeOrder(aBody(first.id, [{ offerId: offer.id, quantity: 1 }]), key).expect(202);
      await placeOrder(aBody(second.id, [{ offerId: offer.id, quantity: 1 }]), key).expect(202);

      expect((await settledOrders(2)).map(({ userId }) => userId).toSorted()).toEqual([first.id, second.id].toSorted());
    });

    it('rejects a key that is not a uuid with 400 and creates nothing', async () => {
      const buyer = await aUser(dataSource.manager);
      const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

      await placeOrder(aBody(buyer.id, [{ offerId: offer.id, quantity: 1 }]), 'not-a-uuid').expect(400);

      expect(await dataSource.getRepository(Order).count()).toBe(0);
    });
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
