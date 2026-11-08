import { Injectable } from '@nestjs/common';
import type { OrderResponseInterface } from '@marketplace/contracts-core';
import type { Order } from '../entity/order.entity.js';

@Injectable()
export class OrderResponse {
  toOrder(order: Order): OrderResponseInterface {
    return {
      id: order.publicId,
      status: order.status,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
