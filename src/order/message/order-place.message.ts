import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OrderCreatedEvent, OrderFailedEvent, OrderPaidEvent } from '@marketplace/messaging-contracts';
import { Order } from '../entity/order.entity.js';
import type { OrderOutboxCreateEntityInterface } from '../entity/order-outbox.entity.js';
import { OrderOutboxAggregateTypeEnum } from '../enum/order-outbox-aggregate-type.enum.js';
import type { OrderFailureInterface } from '../interface/order-failure.interface.js';
import { OrderCreateInput } from '../input/order-create.input.js';
import type { OrderPlaceWorkflowInputInterface } from '../workflow/order-place-workflow.interface.js';
import type { OrderWorkflowOutboxCreateEntityInterface } from '../entity/order-workflow-outbox.entity.js';
import { OrderTaskQueueEnum } from '../enum/order-task-queue.enum.js';
import type { OrderBuyer } from '../entity/order-buyer.entity.js';

@Injectable()
export class OrderPlaceMessage {
  toOrderCreatedOutbox(order: Order, buyer: OrderBuyer): OrderOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
      topic: OrderCreatedEvent.TOPIC,
      aggregateType: OrderOutboxAggregateTypeEnum.ORDER,
      aggregateId: order.publicId,
      type: OrderCreatedEvent.TYPE,
      payload: {
        orderPublicId: order.publicId,
        buyerPublicId: buyer.publicId,
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
        orderPublicId: order.publicId,
        buyerPublicId: order.buyer.publicId,
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
        orderPublicId: order.publicId,
        buyerPublicId: order.buyer.publicId,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        currency: order.currency,
        lines: order.lines.map(({ offerPublicId, quantity, unitPrice, unitDiscountPrice }) => ({ offerPublicId, quantity, unitPrice, unitDiscountPrice })),
        paidAt: order.updatedAt.toISOString(),
      } satisfies OrderPaidEvent.DataInterface,
    }
  }

  toOrderPlaceWorkflowOutbox(order: Order, buyer: OrderBuyer, items: OrderCreateInput['items']): OrderWorkflowOutboxCreateEntityInterface {
    return {
      workflowId: `order-place-${order.publicId}`,
      workflowType: 'orderPlaceWorkflow',
      taskQueue: OrderTaskQueueEnum.ORDER_PLACE,
      input: {
        orderPublicId: order.publicId,
        buyerPublicId: buyer.publicId,
        totalAmount: order.totalAmount,
        items: items.map(({ offerPublicId, quantity }) => ({ offerPublicId, quantity })),
      } satisfies OrderPlaceWorkflowInputInterface,
    }
  }
}
