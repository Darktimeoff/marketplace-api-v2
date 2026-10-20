import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TopicEnum, UserCreatedEvent } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import { OrderBuyerRegisterCommandHandler } from '../command-handler/order-buyer-register.command-handler.js';
import { OrderConsumerGroupEnum } from '../enum/order-consumer-group.enum.js';
import { userCreatedEventSchema } from '../schema/user-created-event.schema.js';

@Injectable()
export class OrderUserEventsGateway implements OnModuleInit {
  private readonly logger = new Logger(OrderUserEventsGateway.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly buyerRegister: OrderBuyerRegisterCommandHandler,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: OrderConsumerGroupEnum.BUYERS,
      topic: TopicEnum.USER_EVENTS,
      handle: (event) => this.handle(event),
    });
  }

  private async handle(event: unknown): Promise<void> {
    if ((event as { type?: unknown } | null)?.type !== UserCreatedEvent.TYPE) {
      return;
    }

    const parsed = userCreatedEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new KafkaRejectedMessageException(parsed.error.message);
    }

    const { userId, userPublicId, identityPublicId } = parsed.data.data;

    if (!identityPublicId) {
      this.logger.debug(`skipped user=${userPublicId} id=${parsed.data.id}: event predates identityPublicId, the buyer was back-filled by migration`);
      return;
    }

    const registered = await this.buyerRegister.execute({ identityPublicId, userId });
    this.logger.log(`${registered ? 'registered' : 'skipped existing'} buyer for user=${userPublicId} id=${parsed.data.id}`);
  }
}
