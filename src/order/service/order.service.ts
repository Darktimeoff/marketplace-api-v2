import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { subject } from '@casl/ability';
import type { AppAbilityType } from '../../generic/auth/app-ability.type.js';
import { EntityNotFoundError } from 'typeorm';
import { OrderRepository } from '../repository/order.repository.js';
import { Order } from '../entity/order.entity.js';
import { Cacheable } from '../../generic/cache/decorator/cacheable.decorator.js';
import { ORDER_CACHE_JITTER_SECONDS, ORDER_CACHE_TTL_SECONDS } from '../constant/order-cache.constant.js';
import { orderCacheKey } from '../cache-key/order.cache-key.js';
import type { OrderResponseInterface } from '@marketplace/contracts-core';
import { OrderResponse } from '../response/order.response.js';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name)
  
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly responses: OrderResponse,
  ) { }

  async findReadableByPublicId(publicId: Order['publicId'], ability: AppAbilityType): Promise<OrderResponseInterface> {
    const order = await this.findByPublicId(publicId);

    if (!ability.can('read', subject('Order', { buyerPublicId: order.buyer.publicId }))) {
      this.logger.warn(`forbidden read of order=${order.publicId}`);
      throw new ForbiddenException('This order belongs to someone else');
    }

    return this.responses.toOrder(order);
  }

  @Cacheable({ key: orderCacheKey, ttlSeconds: ORDER_CACHE_TTL_SECONDS, jitterSeconds: ORDER_CACHE_JITTER_SECONDS })
  async findByPublicId(publicId: Order['publicId']): Promise<Order> {
    try {
      return await this.orderRepository.findByPublicIdOrFail(publicId);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`Order with id ${publicId} not found`);
      }

      throw error;
    }
  }
}
