import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountCustomerChargeRequest, AccountCustomerRefundCommand, OrderCreatedEvent, OrderFailedEvent, OrderPaidEvent, StockReleaseCommand, StockReserveRequest } from '@marketplace/messaging-contracts';
import { Order } from '../entity/order.entity.js';
import type { OrderOutboxCreateEntityInterface } from '../entity/order-outbox.entity.js';
import { OrderOutboxAggregateTypeEnum } from '../enum/order-outbox-aggregate-type.enum.js';
import { OrderOutboxBrokerEnum } from '../enum/order-outbox-broker.enum.js';
import type { OrderFailureInterface } from '../interface/order-failure.interface.js';
import { OrderCreateInput } from '../input/order-create.input.js';
import type { OrderPlaceWorkflowInputInterface } from '../workflow/order-place-workflow.interface.js';

@Injectable()
export class OrderPlaceMessageService {
  toOrderCreatedOutbox(order: Order): OrderOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
      broker: OrderOutboxBrokerEnum.KAFKA,
      topic: OrderCreatedEvent.TOPIC,
      aggregateType: OrderOutboxAggregateTypeEnum.ORDER,
      aggregateId: order.publicId,
      type: OrderCreatedEvent.TYPE,
      payload: {
        orderId: order.id,
        orderPublicId: order.publicId,
        userId: order.userId,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
      } satisfies OrderCreatedEvent.DataInterface,
    }
  }

  toOrderFailedOutbox(order: Order, failure: OrderFailureInterface): OrderOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
      broker: OrderOutboxBrokerEnum.KAFKA,
      topic: OrderFailedEvent.TOPIC,
      aggregateType: OrderOutboxAggregateTypeEnum.ORDER,
      aggregateId: order.publicId,
      type: OrderFailedEvent.TYPE,
      payload: {
        orderId: order.id,
        orderPublicId: order.publicId,
        userId: order.userId,
        status: failure.status,
        reason: failure.reason,
        failedAt: order.updatedAt.toISOString(),
      } satisfies OrderFailedEvent.DataInterface,
    }
  }

  toOrderPaidOutbox(order: Order): OrderOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
      broker: OrderOutboxBrokerEnum.KAFKA,
      topic: OrderPaidEvent.TOPIC,
      aggregateType: OrderOutboxAggregateTypeEnum.ORDER,
      aggregateId: order.publicId,
      type: OrderPaidEvent.TYPE,
      payload: {
        orderId: order.id,
        orderPublicId: order.publicId,
        userId: order.userId,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        currency: order.currency,
        lines: order.lines.map(({ offerId, quantity, unitPrice, unitDiscountPrice }) => ({ offerId, quantity, unitPrice, unitDiscountPrice })),
        paidAt: order.updatedAt.toISOString(),
      } satisfies OrderPaidEvent.DataInterface,
    }
  }

  toOrderPlaceWorkflowInput(order: Order, items: OrderCreateInput['items']): OrderPlaceWorkflowInputInterface {
    return {
      orderId: order.id,
      orderPublicId: order.publicId,
      userId: order.userId,
      totalAmount: order.totalAmount,
      items: items.map(({ offerId, quantity }) => ({ offerId, quantity })),
    }
  }

  toAccountCustomerRefundOutbox(order: Order): OrderOutboxCreateEntityInterface {
    return {
      id: order.publicId,
      broker: OrderOutboxBrokerEnum.RABBITMQ,
      topic: AccountCustomerRefundCommand.TOPIC,
      aggregateType: OrderOutboxAggregateTypeEnum.ORDER,
      aggregateId: order.publicId,
      type: AccountCustomerRefundCommand.TYPE,
      payload: {
        customerId: order.userId,
        amount: order.totalAmount,
        chargeId: order.publicId,
      } satisfies AccountCustomerRefundCommand.DataInterface,
    }
  }

  toStockReleaseOutbox(orderPublicId: string): OrderOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
      broker: OrderOutboxBrokerEnum.RABBITMQ,
      topic: StockReleaseCommand.TOPIC,
      aggregateType: OrderOutboxAggregateTypeEnum.ORDER,
      aggregateId: orderPublicId,
      type: StockReleaseCommand.TYPE,
      payload: {
        orderPublicId,
      } satisfies StockReleaseCommand.DataInterface,
    }
  }

  toAccountCustomerRefundCommand(orderPublicId: string, customerId: number, amount: string): AccountCustomerRefundCommand.MessageType {
    return {
      specversion: '1.0',
      id: orderPublicId,
      source: AccountCustomerRefundCommand.SOURCE,
      type: AccountCustomerRefundCommand.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: orderPublicId,
      correlationid: orderPublicId,
      data: {
        customerId,
        amount,
        chargeId: orderPublicId,
      },
    }
  }

  toStockReleaseCommand(orderPublicId: string): StockReleaseCommand.MessageType {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: StockReleaseCommand.SOURCE,
      type: StockReleaseCommand.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: orderPublicId,
      correlationid: orderPublicId,
      data: {
        orderPublicId,
      },
    }
  }

  toStockReserveRequest(id: string, items: OrderCreateInput['items']): StockReserveRequest.MessageType {
    return {
      specversion: '1.0',
      id,
      source: StockReserveRequest.SOURCE,
      type: StockReserveRequest.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: id,
      correlationid: id,
      data: { items: items.map(({ offerId, quantity }) => ({ offerId, quantity })) },
    }
  }

  toAccountCustomerChargeRequest(id: string, customerId: Order['userId'], amount: string): AccountCustomerChargeRequest.MessageType {
    return {
      specversion: '1.0',
      id,
      source: AccountCustomerChargeRequest.SOURCE,
      type: AccountCustomerChargeRequest.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: id,
      correlationid: id,
      data: { customerId, amount },
    }
  }
}
