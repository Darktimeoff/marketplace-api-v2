import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { Order } from '../entity/order.entity.js';
import { OrderRepository } from '../repository/order.repository.js';

@Injectable()
export class OrderAccessService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async canAccess(orderId: number, userId?: number): Promise<void> {
    let order: Order;
    try {
      order = await this.orderRepository.findByIdOrFail(orderId);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`Order with id ${orderId} not found`);
      }
      throw error;
    }

    if (userId !== undefined && order.orderRecipient.buyerId !== userId) {
      throw new ForbiddenException('Order belongs to a different buyer');
    }
    return;
  }
}
