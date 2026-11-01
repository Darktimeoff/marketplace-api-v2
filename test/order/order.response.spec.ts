import { describe, expect, it } from 'vitest';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderResponse } from '../../src/order/response/order.response.js';
import type { Order } from '../../src/order/entity/order.entity.js';

describe('OrderResponse', () => {
  it('answers the order by its publicId and never exposes the internal id or the buyer', () => {
    const order = {
      id: 486,
      publicId: '25570e68-8caa-481f-b42a-3af850d96c7b',
      buyerId: 45,
      status: OrderStatusEnum.paid,
      totalAmount: '165.00',
      discountAmount: '10.00',
      currency: CurrencyEnum.UAH,
      createdAt: new Date('2026-11-01T12:22:20.139Z'),
      updatedAt: new Date('2026-11-01T12:22:21.196Z'),
    } as Order;

    expect(new OrderResponse().toOrder(order)).toEqual({
      id: order.publicId,
      status: OrderStatusEnum.paid,
      totalAmount: '165.00',
      discountAmount: '10.00',
      currency: CurrencyEnum.UAH,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  });
});
