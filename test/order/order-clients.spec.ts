import { describe, expect, it, vi } from 'vitest';
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AccountClient } from '../../src/order/client/account.client.js';
import { SellerOfferClient } from '../../src/order/client/seller-offer.client.js';
import { OrderPlaceMessage } from '../../src/order/message/order-place.message.js';
import type { SellerOfferService } from '../../src/seller-offer/service/seller-offer.service.js';

const order = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';
const buyer = '9c82efe4-36c4-4767-b525-42e95cdbc5a3';
const offer = '45b4b670-96f8-4cc3-9a2c-a9e284bb2551';

function anAmqp(data: object): { amqp: AmqpConnection; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({ data });
  return { amqp: { request } as unknown as AmqpConnection, request };
}

describe('order clients over RabbitMQ', () => {
  it('reserves stock with a request that expires with its timeout and answers only the data', async () => {
    const { amqp, request } = anAmqp({ status: 'reserved' });
    const client = new SellerOfferClient({} as SellerOfferService, amqp, new OrderPlaceMessage());

    expect(await client.reserveStock({ orderPublicId: order, items: [{ offerPublicId: offer, quantity: 2 }] })).toEqual({ status: 'reserved' });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'seller-offer.commands',
      routingKey: 'seller-offer.stock.reserve',
      timeout: 5000,
      expiration: 5000,
      payload: expect.objectContaining({ id: order, data: { orderPublicId: order, items: [{ offerPublicId: offer, quantity: 2 }] } }),
    }));
  });

  it('charges and refunds the customer by the person publicId, keyed by the order', async () => {
    const { amqp, request } = anAmqp({ status: 'success' });
    const client = new AccountClient(amqp, new OrderPlaceMessage());

    await client.charge({ chargeId: order, customerPublicId: buyer, amount: '160.00' });
    await client.refund({ chargeId: order, customerPublicId: buyer, amount: '160.00' });

    expect(request.mock.calls.map(([options]) => [options.routingKey, options.payload.id, options.payload.data])).toEqual([
      ['account.customer.charge', order, { chargeId: order, customerPublicId: buyer, amount: '160.00' }],
      ['account.customer.refund', order, { chargeId: order, customerPublicId: buyer, amount: '160.00' }],
    ]);
  });
});
