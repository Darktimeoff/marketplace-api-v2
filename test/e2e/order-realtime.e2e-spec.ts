import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { get as httpGet, type IncomingMessage, type ClientRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { CountryCodeEnum, CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { aSellerOffer, aUser } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

interface StreamedEventInterface {
  id: number;
  orderId: number;
  status: OrderStatusEnum;
}

interface StreamInterface {
  response: IncomingMessage;
  events(): StreamedEventInterface[];
  close(): void;
}

describe('Order realtime over Kafka (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  async function placeOrder(balance: string): Promise<{ orderId: number; userId: number }> {
    const buyer = await aUser(dataSource.manager);
    await dataSource.query(`INSERT INTO "Account" ("customerId", "balance") VALUES ($1, $2)`, [buyer.id, balance]);
    const offer = await aSellerOffer(dataSource.manager, { price: '100.00', onHandQuantity: 5 });

    const response = await request(app.getHttpServer())
      .post('/order')
      .send({
        userId: buyer.id,
        recipient: {
          fullName: 'Jane Doe',
          phone: { countryCode: CountryCodeEnum.UA, rawNumber: '+380501234567', fullNumber: '+380501234567', nationalNumber: '0501234567' },
          address: { addressLine: 'Khreshchatyk St, 1', city: 'Kyiv' },
        },
        items: [{ offerId: offer.id, quantity: 1 }],
        currency: CurrencyEnum.UAH,
      });

    return { orderId: response.body.id ?? (await dataSource.query(`SELECT max("id") AS id FROM "Order"`))[0].id, userId: buyer.id };
  }

  function openStream(orderId: number, userId?: number, lastEventId?: number): Promise<StreamInterface> {
    const { port } = app.getHttpServer().address() as AddressInfo;
    const chunks: string[] = [];

    return new Promise((resolve, reject) => {
      const req: ClientRequest = httpGet({
        hostname: '127.0.0.1',
        port,
        path: `/orders/${orderId}/events${userId === undefined ? '' : `?userId=${userId}`}`,
        headers: lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) },
      }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => chunks.push(chunk));
        resolve({
          response: res,
          events: () => chunks.join('').split('\n\n').flatMap((block) => {
            const id = /^id: (\d+)$/m.exec(block);
            const data = /^data: (.+)$/m.exec(block);
            return id && data && block.includes('event: order.status') ? [{ id: Number(id[1]), ...JSON.parse(data[1]) }] : [];
          }),
          close: () => req.destroy(),
        });
      });
      req.on('error', reject);
    });
  }

  async function eventsOf(stream: StreamInterface, count: number): Promise<StreamedEventInterface[]> {
    return vi.waitFor(() => {
      const events = stream.events();
      if (events.length < count) throw new Error(`got ${events.length} of ${count} events`);
      return events;
    }, { timeout: 15000, interval: 100 });
  }

  it('streams pending_payment then paid for a paid order, from order.events', async () => {
    const { orderId, userId } = await placeOrder('1000.00');
    const stream = await openStream(orderId, userId);

    try {
      expect(stream.response.headers['content-type']).toContain('text/event-stream');
      const events = await eventsOf(stream, 2);
      expect(events.map(({ orderId: id, status }) => ({ orderId: id, status }))).toEqual([
        { orderId, status: OrderStatusEnum.pending_payment },
        { orderId, status: OrderStatusEnum.paid },
      ]);
      expect(events[1].id).toBeGreaterThan(events[0].id);
    } finally {
      stream.close();
    }
  });

  it('streams failed_payment when the payment is refused', async () => {
    const { orderId, userId } = await placeOrder('10.00');
    const stream = await openStream(orderId, userId);

    try {
      const events = await eventsOf(stream, 2);
      expect(events.map(({ status }) => status)).toEqual([OrderStatusEnum.pending_payment, OrderStatusEnum.failed_payment]);
    } finally {
      stream.close();
    }
  });

  it('replays only the events after Last-Event-ID', async () => {
    const { orderId, userId } = await placeOrder('1000.00');
    const first = await openStream(orderId, userId);
    const [created, paid] = await eventsOf(first, 2).finally(() => first.close());

    const resumed = await openStream(orderId, userId, created.id);

    try {
      const events = await eventsOf(resumed, 1);
      expect(events).toEqual([paid]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(resumed.events()).toEqual([paid]);
    } finally {
      resumed.close();
    }
  });

  it('rejects SSE connections from a different buyer before opening the stream', async () => {
    const { orderId } = await placeOrder('1000.00');
    const other = await aUser(dataSource.manager);

    await request(app.getHttpServer()).get(`/orders/${orderId}/events?userId=${other.id}`).expect(403);
  });

  it('rejects an invalid buyer id and an unknown order', async () => {
    const { orderId } = await placeOrder('1000.00');

    await request(app.getHttpServer()).get(`/orders/${orderId}/events?userId=abc`).expect(400);
    await request(app.getHttpServer()).get('/orders/999999/events').expect(404);
  });
});
