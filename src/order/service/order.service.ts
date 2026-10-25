import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { subject } from '@casl/ability';
import type { AppAbilityType } from '../../generic/auth/app-ability.type.js';
import { EntityNotFoundError } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderRepository } from '../repository/order.repository.js';
import { Order } from '../entity/order.entity.js';
import { Cacheable } from '../../generic/cache/decorator/cacheable.decorator.js';
import { ORDER_CACHE_JITTER_SECONDS, ORDER_CACHE_TTL_SECONDS } from '../constant/order-cache.constant.js';
import { orderCacheKey } from '../cache-key/order.cache-key.js';

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name)
  
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly amqpConnection: AmqpConnection
  ) { }

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
        channel.on('return', (msg: ConsumeMessage) => {
          this.logger.error(`unroutable ${msg.fields.exchange}/${msg.fields.routingKey}`);
        });
      });
  }

  async findReadableById(id: Order['id'], ability: AppAbilityType): Promise<Order> {
    const order = await this.findById(id);

    if (!ability.can('read', subject('Order', { ownerIdentityPublicId: order.ownerIdentityPublicId }))) {
      this.logger.warn(`forbidden read of order=${order.publicId}`);
      throw new ForbiddenException('This order belongs to someone else');
    }

    return order;
  }

  @Cacheable({ key: orderCacheKey, ttlSeconds: ORDER_CACHE_TTL_SECONDS, jitterSeconds: ORDER_CACHE_JITTER_SECONDS })
  async findById(id: Order['id']): Promise<Order> {
    try {
      return await this.orderRepository.findByIdOrFail(id);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }

      throw error;
    }
  }
}
