import { describe, expect, it } from 'vitest';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { orderStatusEventSchema } from '../../src/order/schema/order-status-event.schema.js';

const order = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';
const buyer = '9c82efe4-36c4-4767-b525-42e95cdbc5a3';

describe('orderStatusEventSchema', () => {
  it('reads the current order events by orderPublicId', () => {
    expect(orderStatusEventSchema.parse({ type: 'order.paid', data: { orderPublicId: order, buyerPublicId: buyer } }).data).toEqual({ orderPublicId: order });
  });

  it('reads order events published before the int ids were dropped', () => {
    const created = { type: 'order.created', data: { orderId: 7, orderPublicId: order, userId: 4 } };
    const failed = { type: 'order.failed', data: { orderId: 7, orderPublicId: order, userId: 4, status: OrderStatusEnum.failed_payment } };

    expect(orderStatusEventSchema.parse(created).data).toEqual({ orderPublicId: order });
    expect(orderStatusEventSchema.parse(failed).data).toEqual({ orderPublicId: order, status: OrderStatusEnum.failed_payment });
  });

  it('rejects an order event without its publicId', () => {
    expect(orderStatusEventSchema.safeParse({ type: 'order.paid', data: { orderId: 7 } }).success).toBe(false);
  });
});
