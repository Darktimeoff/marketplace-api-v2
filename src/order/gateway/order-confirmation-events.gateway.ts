// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrderCreatedEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import { OrderConfirmCommandHandler } from '../command-handler/order-confirm.command-handler.js';
import { OrderConsumerGroupEnum } from '../enum/order-consumer-group.enum.js';
import { orderCreatedEventSchema } from '../schema/order-created-event.schema.js';

@Injectable()
export class OrderConfirmationEventsGateway implements OnModuleInit {
  private readonly logger = new Logger(OrderConfirmationEventsGateway.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly orderConfirm: OrderConfirmCommandHandler,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: OrderConsumerGroupEnum.CONFIRMATION,
      topic: TopicEnum.ORDER_EVENTS,
      handle: (event) => this.handle(event),
    });
  }

  async handle(event: unknown): Promise<void> {
    if ((event as { type?: unknown } | null)?.type !== OrderCreatedEvent.TYPE) {
      return;
    }

    const parsed = orderCreatedEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new KafkaRejectedMessageException(parsed.error.message);
    }

    const { orderPublicId, userId } = parsed.data.data;
    const applied = await this.orderConfirm.execute(parsed.data.id, { orderPublicId, userId });
    this.logger.log(`${applied ? 'confirmed' : 'skipped duplicate'} order=${orderPublicId} id=${parsed.data.id}`);
  }
}
