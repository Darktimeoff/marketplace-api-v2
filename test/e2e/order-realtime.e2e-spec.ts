import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { get as httpGet, type IncomingMessage, type ClientRequest } from 'node:http';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderNotifyService } from '../../src/order/service/order-notify.service.js';
import { OrderStatusEnum, CurrencyEnum } from '@marketplace/contracts-core';
import { anOrderRecipient, aUser } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

describe('Order realtime (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let realtime: OrderNotifyService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    dataSource = app.get(DataSource);
    realtime = app.get(OrderNotifyService);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createOrder(buyerId?: number): Promise<Order> {
    const recipient = await anOrderRecipient(dataSource.manager, { buyerId });
    const orders = dataSource.getRepository(Order);
    return orders.save(orders.create({
      orderRecipientId: recipient.id,
      totalAmount: '100.00',
      discountAmount: '0.00',
      currency: CurrencyEnum.UAH,
    }));
  }

  it('updates status for the owner and publishes one event', async () => {
    const buyer = await aUser(dataSource.manager);
    const order = await createOrder(buyer.id);
    const events = vi.fn();
    const unsubscribe = realtime.subscribe(order.id, events);

    const response = await request(app.getHttpServer())
      .patch(`/orders/${order.id}/status`)
      .send({ userId: buyer.id, status: OrderStatusEnum.preparing })
      .expect(200);

    unsubscribe();
    expect(response.body).toMatchObject({ id: order.id, status: OrderStatusEnum.preparing });
    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0]).toMatchObject({ orderId: order.id, status: OrderStatusEnum.preparing });
  });

  it('rejects a status update from a different buyer without publishing', async () => {
    const owner = await aUser(dataSource.manager);
    const other = await aUser(dataSource.manager);
    const order = await createOrder(owner.id);
    const events = vi.fn();
    const unsubscribe = realtime.subscribe(order.id, events);

    await request(app.getHttpServer())
      .patch(`/orders/${order.id}/status`)
      .send({ userId: other.id, status: OrderStatusEnum.preparing })
      .expect(403);

    unsubscribe();
    expect(events).not.toHaveBeenCalled();
  });

  it('streams status updates as SSE events and disconnects cleanly', async () => {
    const buyer = await aUser(dataSource.manager);
    const order = await createOrder(buyer.id);
    const address = app.getHttpServer().address();
    const chunks: string[] = [];

    const response = await new Promise<{ response: IncomingMessage; request: ClientRequest }>((resolve, reject) => {
      const req = httpGet(`http://127.0.0.1:${address.port}/orders/${order.id}/events?userId=${buyer.id}`, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => chunks.push(chunk));
        resolve({ response: res, request: req });
      });
      req.on('error', reject);
    });

    expect(response.response.headers['content-type']).toContain('text/event-stream');
    await request(app.getHttpServer())
      .patch(`/orders/${order.id}/status`)
      .send({ userId: buyer.id, status: OrderStatusEnum.preparing })
      .expect(200);
    await vi.waitFor(() => expect(chunks.join('')).toContain('event: order.status'));
    expect(chunks.join('')).toContain('data: {"orderId":' + order.id);
    expect(chunks.join('')).toContain('"status":"preparing"');
    response.request.destroy();
  });

  it('sends the event-stream content type before the first status event', async () => {
    const order = await createOrder();
    const address = app.getHttpServer().address();
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = httpGet(`http://127.0.0.1:${address.port}/orders/${order.id}/events`, resolve);
      req.setTimeout(1000, () => req.destroy(new Error('SSE header timeout')));
      req.on('error', reject);
    });

    expect(response.headers['content-type']).toContain('text/event-stream');
    response.destroy();
  });

  it('replays events after Last-Event-ID without sending earlier IDs', async () => {
    const buyer = await aUser(dataSource.manager);
    const order = await createOrder(buyer.id);
    const events = [OrderStatusEnum.paid, OrderStatusEnum.confirmed, OrderStatusEnum.preparing, OrderStatusEnum.shipped]
      .map((status) => realtime.notifyStatusChanged(order.id, status));

    const address = app.getHttpServer().address();
    const chunks: string[] = [];
    const response = await new Promise<{ response: IncomingMessage; request: ClientRequest }>((resolve, reject) => {
      const req = httpGet({
        hostname: '127.0.0.1',
        port: address.port,
        path: `/orders/${order.id}/events?userId=${buyer.id}`,
        headers: { 'Last-Event-ID': String(events[2].id) },
      }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => chunks.push(chunk));
        resolve({ response: res, request: req });
      });
      req.on('error', reject);
    });

    expect(response.response.headers['content-type']).toContain('text/event-stream');
    await vi.waitFor(() => expect(chunks.join('')).toContain(`id: ${events[3].id}\n`));
    expect(chunks.join('')).not.toContain(`id: ${events[2].id}\n`);
    response.request.destroy();
  });

  it('rejects SSE connections from a different buyer before opening the stream', async () => {
    const owner = await aUser(dataSource.manager);
    const other = await aUser(dataSource.manager);
    const order = await createOrder(owner.id);

    await request(app.getHttpServer())
      .get(`/orders/${order.id}/events?userId=${other.id}`)
      .expect(403);
  });

  it('rejects missing buyer identity and unknown orders', async () => {
    const buyer = await aUser(dataSource.manager);
    const order = await createOrder(buyer.id);

    await request(app.getHttpServer())
      .patch(`/orders/${order.id}/status`)
      .send({ status: OrderStatusEnum.preparing })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/orders/999999/status')
      .send({ userId: buyer.id, status: OrderStatusEnum.preparing })
      .expect(404);
  });
});
