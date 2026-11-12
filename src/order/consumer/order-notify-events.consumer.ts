import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderCreatedEvent, OrderFailedEvent, OrderPaidEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { EVENT_SUBSCRIBER } from '../../generic/messaging/constant/messaging.constant.js';
import { EventRejectedException } from '../../generic/messaging/exception/event-rejected.exception.js';
import type { EventPositionInterface, EventSubscriberInterface } from '../../generic/messaging/interface/event-subscriber.interface.js';
import { OrderNotifyService } from '../service/order-notify.service.js';
import { OrderConsumerGroupEnum } from '../enum/order-consumer-group.enum.js';
import { orderStatusEventSchema } from '../schema/order-status-event.schema.js';

@Injectable()
export class OrderNotifyEventsConsumer implements OnModuleInit {
  private readonly handledTypes: string[] = [OrderCreatedEvent.TYPE, OrderPaidEvent.TYPE, OrderFailedEvent.TYPE];

  constructor(
    @Inject(EVENT_SUBSCRIBER) private readonly consumer: EventSubscriberInterface,
    private readonly orderNotify: OrderNotifyService,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: OrderConsumerGroupEnum.NOTIFY,
      topic: TopicEnum.ORDER_EVENTS,
      broadcast: true,
      handle: (event, position) => this.handle(event, position),
    });
  }

  private async handle(event: unknown, position: EventPositionInterface): Promise<void> {
    if (!this.handledTypes.includes((event as { type?: string } | null)?.type ?? '')) {
      return;
    }

    const parsed = orderStatusEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new EventRejectedException(parsed.error.message);
    }

    this.orderNotify.record({ id: Number(position.offset) + 1, orderPublicId: parsed.data.data.orderPublicId, status: this.toStatus(parsed.data) });
  }

  private toStatus(event: ReturnType<typeof orderStatusEventSchema.parse>): OrderStatusEnum {
    switch (event.type) {
      case OrderCreatedEvent.TYPE:
        return OrderStatusEnum.pending_payment;
      case OrderPaidEvent.TYPE:
        return OrderStatusEnum.paid;
      case OrderFailedEvent.TYPE:
        return event.data.status;
    }
  }
}
