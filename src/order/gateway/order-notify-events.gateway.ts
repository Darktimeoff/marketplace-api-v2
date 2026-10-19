import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderCreatedEvent, OrderFailedEvent, OrderPaidEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import type { KafkaMessagePositionInterface } from '../../generic/kafka/interface/kafka-subscription.interface.js';
import { OrderNotifyService } from '../service/order-notify.service.js';
import { OrderConsumerGroupEnum } from '../enum/order-consumer-group.enum.js';
import { orderStatusEventSchema } from '../schema/order-status-event.schema.js';

@Injectable()
export class OrderNotifyEventsGateway implements OnModuleInit {
  private readonly handledTypes: string[] = [OrderCreatedEvent.TYPE, OrderPaidEvent.TYPE, OrderFailedEvent.TYPE];

  constructor(
    private readonly consumer: KafkaConsumerService,
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

  private async handle(event: unknown, position: KafkaMessagePositionInterface): Promise<void> {
    if (!this.handledTypes.includes((event as { type?: string } | null)?.type ?? '')) {
      return;
    }

    const parsed = orderStatusEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new KafkaRejectedMessageException(parsed.error.message);
    }

    this.orderNotify.record({ id: Number(position.offset) + 1, orderId: parsed.data.data.orderId, status: this.toStatus(parsed.data) });
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
