import { describe, expect, it } from 'vitest';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderPlaceMessageService } from '../../src/order/service/order-place-message.service.js';
import type { Order } from '../../src/order/entity/order.entity.js';

const buyerPublicId = '9c82efe4-36c4-4767-b525-42e95cdbc5a3';
const offerPublicId = '1b8d0c7e-4f2a-4c5e-9d3b-7a6e5f4d3c2b';

const order = {
  id: 7,
  publicId: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
  buyer: { id: 4, publicId: buyerPublicId },
  totalAmount: '160.00',
  discountAmount: '40.00',
  currency: CurrencyEnum.UAH,
  createdAt: new Date('2026-10-10T10:00:00.000Z'),
  updatedAt: new Date('2026-10-10T10:00:05.000Z'),
  lines: [{ offerPublicId, quantity: 2, unitPrice: '100.00', unitDiscountPrice: '80.00' }],
} as unknown as Order;

describe('OrderPlaceMessageService', () => {
  const messages = new OrderPlaceMessageService();

  it('builds order events as kafka outbox rows keyed by the order', () => {
    expect(messages.toOrderPaidOutbox(order)).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      topic: 'order.events',
      aggregateType: 'Order',
      aggregateId: order.publicId,
      type: 'order.paid',
      payload: {
        orderId: 7,
        orderPublicId: order.publicId,
        buyerPublicId,
        totalAmount: '160.00',
        discountAmount: '40.00',
        currency: CurrencyEnum.UAH,
        lines: [{ offerPublicId, quantity: 2, unitPrice: '100.00', unitDiscountPrice: '80.00' }],
        paidAt: '2026-10-10T10:00:05.000Z',
      },
    });
    expect(messages.toOrderFailedOutbox(order, { status: OrderStatusEnum.failed_payment, reason: 'payment_rejected' })).toMatchObject({
      type: 'order.failed',
      payload: { orderId: 7, buyerPublicId, status: 'failed_payment', reason: 'payment_rejected', failedAt: '2026-10-10T10:00:05.000Z' },
    });
    expect(messages.toOrderCreatedOutbox(order, order.buyer).payload).toEqual(expect.objectContaining({ buyerPublicId, createdAt: '2026-10-10T10:00:00.000Z' }));
  });

  it('builds the workflow start as an outbox row keyed by the order publicId', () => {
    expect(messages.toOrderPlaceWorkflowOutbox(order, order.buyer, [{ offerPublicId, quantity: 2 }])).toEqual({
      workflowId: `order-place-${order.publicId}`,
      workflowType: 'orderPlaceWorkflow',
      taskQueue: 'order-place',
      input: {
        orderId: 7,
        orderPublicId: order.publicId,
        buyerPublicId,
        totalAmount: '160.00',
        items: [{ offerPublicId, quantity: 2 }],
      },
    });
  });

  it('builds the reserve and charge requests as CloudEvents', () => {
    expect(messages.toStockReserveRequest(order.publicId, [{ offerPublicId, quantity: 2 }])).toMatchObject({
      specversion: '1.0',
      id: order.publicId,
      type: 'seller-offer.stock.reserve',
      subject: order.publicId,
      data: { items: [{ offerPublicId, quantity: 2 }] },
    });
    expect(messages.toAccountCustomerChargeRequest(order.publicId, buyerPublicId, '160.00')).toMatchObject({
      type: 'account.customer.charge',
      data: { customerPublicId: buyerPublicId, amount: '160.00' },
    });
  });

  it('builds the compensations as requests keyed by the order publicId, the refund pointing at the charge', () => {
    expect(messages.toAccountCustomerRefundRequest(order.publicId, buyerPublicId, '160.00')).toMatchObject({
      specversion: '1.0',
      id: order.publicId,
      type: 'account.customer.refund',
      subject: order.publicId,
      data: { customerPublicId: buyerPublicId, amount: '160.00', chargeId: order.publicId },
    });
    expect(messages.toStockReleaseRequest(order.publicId)).toMatchObject({
      id: order.publicId,
      type: 'seller-offer.stock.release',
      data: { orderPublicId: order.publicId },
    });
  });
});
