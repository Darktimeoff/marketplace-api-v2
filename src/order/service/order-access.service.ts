import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { Order } from '../entity/order.entity.js';
import { OrderRepository } from '../repository/order.repository.js';

@Injectable()
export class OrderAccessService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async canAccess(orderPublicId: string, buyerPublicId?: string): Promise<void> {
    let order: Order;
    try {
      order = await this.orderRepository.findByPublicIdOrFail(orderPublicId);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`Order with id ${orderPublicId} not found`);
      }
      throw error;
    }

    if (buyerPublicId !== undefined && order.buyer.publicId !== buyerPublicId) {
      throw new ForbiddenException('Order belongs to a different buyer');
    }
    return;
  }
}
