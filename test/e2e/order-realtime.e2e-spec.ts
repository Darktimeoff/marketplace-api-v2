import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { get as httpGet, type IncomingMessage, type ClientRequest } from 'node:http';
import { io } from 'socket.io-client';
import { spawn } from 'node:child_process';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderNotifyService } from '../../src/order/service/order-notify.service.js';
import { OrderStatusEnum, CurrencyEnum } from '../../src/generic/enum/enums.js';
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

  it('allows an owning websocket client to join and receive order events', async () => {
    const buyer = await aUser(dataSource.manager);
    const order = await createOrder(buyer.id);
    const address = app.getHttpServer().address();
    const client = io(`http://127.0.0.1:${address.port}`, {
      auth: { userId: buyer.id },
      transports: ['websocket'],
      timeout: 3000,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      const joined = await new Promise<boolean>((resolve) => {
        client.emit('join', { orderId: order.id }, (ack: { joined: boolean }) => resolve(ack.joined));
      });
      expect(joined).toBe(true);

      const received = new Promise((resolve) => client.once('order.status', resolve));
      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .send({ userId: buyer.id, status: OrderStatusEnum.preparing })
        .expect(200);
      expect(await received).toMatchObject({ orderId: order.id, status: OrderStatusEnum.preparing });
    } finally {
      client.disconnect();
    }
  });

  it('rejects a websocket join for a non-owner', async () => {
    const owner = await aUser(dataSource.manager);
    const other = await aUser(dataSource.manager);
    const order = await createOrder(owner.id);
    const address = app.getHttpServer().address();
    const client = io(`http://127.0.0.1:${address.port}`, {
      auth: { userId: other.id },
      transports: ['websocket'],
      timeout: 3000,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      const joinError = new Promise<{ status: string }>((resolve) => client.once('exception', resolve));
      client.emit('join', { orderId: order.id });
      await expect(joinError).resolves.toMatchObject({ status: 'error' });
      const received = vi.fn();
      client.on('order.status', received);
      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .send({ userId: owner.id, status: OrderStatusEnum.preparing })
        .expect(200);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
    }
  });

  it('reports measured room isolation in default and same-room demo modes', async () => {
    const buyerA = await aUser(dataSource.manager);
    const buyerB = await aUser(dataSource.manager);
    const orderA = await createOrder(buyerA.id);
    const orderB = await createOrder(buyerB.id);
    const address = app.getHttpServer().address();
    const serverUrl = `http://127.0.0.1:${address.port}`;

    async function runDemo(sameRoom: boolean): Promise<{ output: string; exitCode: number | null }> {
      const child = spawn(process.execPath, ['scripts/realtime-demo.mjs', ...(sameRoom ? ['--same-room'] : [])], {
        env: {
          ...process.env,
          API_URL: serverUrl,
          ORDER_ID_A: String(orderA.id),
          ORDER_ID_B: String(orderB.id),
          BUYER_ID_A: String(buyerA.id),
          BUYER_ID_B: String(buyerB.id),
          EVENT_TIMEOUT_MS: '1500',
          ORDER_STATUS: OrderStatusEnum.preparing,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => { output += chunk; });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => { output += chunk; });
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Realtime demo did not exit before its deadline'));
        }, 5000);
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      return { output, exitCode };
    }

    const isolated = await runDemo(false);
    expect(isolated.exitCode, isolated.output).toBe(0);
    expect(isolated.output).toMatch(/A_RECEIVED=1/);
    expect(isolated.output).toMatch(/B_RECEIVED=0/);

    const sameRoom = await runDemo(true);
    expect(sameRoom.exitCode).toBe(0);
    expect(sameRoom.output).toMatch(/A_RECEIVED=1/);
    expect(sameRoom.output).toMatch(/B_RECEIVED=1/);
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
