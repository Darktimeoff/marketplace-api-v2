import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderRepository } from '../repository/order.repository.js';
import { Order } from '../entity/order.entity.js';
import { OrderNotifyService } from './order-notify.service.js';
import { OrderAccessService } from './order-access.service.js';

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name)
  
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderNotify: OrderNotifyService,
    private readonly orderAccess: OrderAccessService,
    private readonly amqpConnection: AmqpConnection
  ) { }

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
        channel.on('return', (msg: ConsumeMessage) => {
          this.logger.error(`unroutable ${msg.fields.exchange}/${msg.fields.routingKey}`);
        });
      });
  }

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

  async updateStatus(
    orderId: number,
    userId: number,
    status: OrderStatusEnum,
  ): Promise<Order> {
    await this.orderAccess.canAccess(orderId, userId);
    const updatedOrder = await this.orderRepository.updateStatusById(orderId, status);
    this.orderNotify.notifyStatusChanged(orderId, status);
    return updatedOrder;
  }
}
