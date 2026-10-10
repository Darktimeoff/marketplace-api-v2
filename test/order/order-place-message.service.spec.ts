import { describe, expect, it } from 'vitest';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderPlaceMessageService } from '../../src/order/service/order-place-message.service.js';
import type { Order } from '../../src/order/entity/order.entity.js';

const order = {
  id: 7,
  publicId: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
  userId: 4,
  totalAmount: '160.00',
  discountAmount: '40.00',
  currency: CurrencyEnum.UAH,
  createdAt: new Date('2026-10-10T10:00:00.000Z'),
  updatedAt: new Date('2026-10-10T10:00:05.000Z'),
  lines: [{ offerId: 3, quantity: 2, unitPrice: '100.00', unitDiscountPrice: '80.00' }],
} as unknown as Order;

describe('OrderPlaceMessageService', () => {
  const messages = new OrderPlaceMessageService();

  it('builds order events as kafka outbox rows keyed by the order', () => {
    expect(messages.toOrderPaidOutbox(order)).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      broker: 'kafka',
      topic: 'order.events',
      aggregateType: 'Order',
      aggregateId: order.publicId,
      type: 'order.paid',
      payload: {
        orderId: 7,
        orderPublicId: order.publicId,
        userId: 4,
        totalAmount: '160.00',
        discountAmount: '40.00',
        currency: CurrencyEnum.UAH,
        lines: [{ offerId: 3, quantity: 2, unitPrice: '100.00', unitDiscountPrice: '80.00' }],
        paidAt: '2026-10-10T10:00:05.000Z',
      },
    });
    expect(messages.toOrderFailedOutbox(order, { status: OrderStatusEnum.failed_payment, reason: 'payment_rejected' })).toMatchObject({
      broker: 'kafka',
      type: 'order.failed',
      payload: { orderId: 7, status: 'failed_payment', reason: 'payment_rejected', failedAt: '2026-10-10T10:00:05.000Z' },
    });
    expect(messages.toOrderCreatedOutbox(order).payload).toEqual(expect.objectContaining({ createdAt: '2026-10-10T10:00:00.000Z' }));
  });

  it('builds compensations as rabbitmq outbox rows, the refund keeping the order publicId as its id', () => {
    expect(messages.toAccountCustomerRefundOutbox(order)).toEqual({
      id: order.publicId,
      broker: 'rabbitmq',
      topic: 'account.commands',
      aggregateType: 'Order',
      aggregateId: order.publicId,
      type: 'account.customer.refund',
      payload: { customerId: 4, amount: '160.00', chargeId: order.publicId },
    });
    expect(messages.toStockReleaseOutbox(order.publicId)).toMatchObject({
      broker: 'rabbitmq',
      topic: 'seller-offer.commands',
      type: 'seller-offer.stock.release',
      payload: { orderPublicId: order.publicId },
    });
  });

  it('builds the reserve and charge requests as CloudEvents', () => {
    expect(messages.toStockReserveRequest(order.publicId, [{ offerId: 3, quantity: 2 }])).toMatchObject({
      specversion: '1.0',
      id: order.publicId,
      type: 'seller-offer.stock.reserve',
      subject: order.publicId,
      data: { items: [{ offerId: 3, quantity: 2 }] },
    });
    expect(messages.toAccountCustomerChargeRequest(order.publicId, 4, '160.00')).toMatchObject({
      type: 'account.customer.charge',
      data: { customerId: 4, amount: '160.00' },
    });
  });
});
