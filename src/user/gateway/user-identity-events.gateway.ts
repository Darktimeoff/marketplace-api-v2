import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IdentityRegisteredEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import { UserCreateCommandHandler } from '../command-handler/user-create.command-handler.js';
import { UserConsumerGroupEnum } from '../enum/user-consumer-group.enum.js';
import { identityRegisteredEventSchema } from '../schema/identity-registered-event.schema.js';

@Injectable()
export class UserIdentityEventsGateway implements OnModuleInit {
  private readonly logger = new Logger(UserIdentityEventsGateway.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly userCreate: UserCreateCommandHandler,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: UserConsumerGroupEnum.PROFILE,
      topic: TopicEnum.IDENTITY_EVENTS,
      handle: (event) => this.handle(event),
    });
  }

  private async handle(event: unknown): Promise<void> {
    if ((event as { type?: unknown } | null)?.type !== IdentityRegisteredEvent.TYPE) {
      return;
    }

    const parsed = identityRegisteredEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new KafkaRejectedMessageException(parsed.error.message);
    }

    const { identityId, email, phoneNumber } = parsed.data.data;
    await this.userCreate.execute({ identityId, email, phoneNumber });
    this.logger.log(`created user for identity=${parsed.data.data.identityPublicId} id=${parsed.data.id}`);
  }
}
