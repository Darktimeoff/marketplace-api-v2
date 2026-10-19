import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountCustomerChargeRequest, AccountCustomerRefundRequest, OrderCreatedEvent, OrderFailedEvent, OrderPaidEvent, StockReleaseRequest, StockReserveRequest } from '@marketplace/messaging-contracts';
import { Order } from '../entity/order.entity.js';
import type { OrderOutboxCreateEntityInterface } from '../entity/order-outbox.entity.js';
import { OrderOutboxAggregateTypeEnum } from '../enum/order-outbox-aggregate-type.enum.js';
import type { OrderFailureInterface } from '../interface/order-failure.interface.js';
import { OrderCreateInput } from '../input/order-create.input.js';
import type { OrderPlaceWorkflowInputInterface } from '../workflow/order-place-workflow.interface.js';
import type { OrderWorkflowOutboxCreateEntityInterface } from '../entity/order-workflow-outbox.entity.js';
import { OrderTaskQueueEnum } from '../enum/order-task-queue.enum.js';

@Injectable()
export class OrderPlaceMessageService {
  toOrderCreatedOutbox(order: Order): OrderOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
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

  toOrderPlaceWorkflowOutbox(order: Order, items: OrderCreateInput['items']): OrderWorkflowOutboxCreateEntityInterface {
    return {
      workflowId: `order-place-${order.publicId}`,
      workflowType: 'orderPlaceWorkflow',
      taskQueue: OrderTaskQueueEnum.ORDER_PLACE,
      input: {
        orderId: order.id,
        orderPublicId: order.publicId,
        userId: order.userId,
        totalAmount: order.totalAmount,
        items: items.map(({ offerId, quantity }) => ({ offerId, quantity })),
      } satisfies OrderPlaceWorkflowInputInterface,
    }
  }

  toAccountCustomerRefundRequest(orderPublicId: string, customerId: number, amount: string): AccountCustomerRefundRequest.MessageType {
    return {
      specversion: '1.0',
      id: orderPublicId,
      source: AccountCustomerRefundRequest.SOURCE,
      type: AccountCustomerRefundRequest.TYPE,
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

  toStockReleaseRequest(orderPublicId: string): StockReleaseRequest.MessageType {
    return {
      specversion: '1.0',
      id: orderPublicId,
      source: StockReleaseRequest.SOURCE,
      type: StockReleaseRequest.TYPE,
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
