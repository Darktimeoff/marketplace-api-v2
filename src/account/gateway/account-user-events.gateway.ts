import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TopicEnum, UserCreatedEvent } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import { AccountCreateCommandHandler } from '../command-handler/account-create.command-handler.js';
import { AccountConsumerGroupEnum } from '../enum/account-consumer-group.enum.js';
import { userCreatedEventSchema } from '../schema/user-created-event.schema.js';

@Injectable()
export class AccountUserEventsGateway implements OnModuleInit {
  private readonly logger = new Logger(AccountUserEventsGateway.name);

  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly accountCreate: AccountCreateCommandHandler,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: AccountConsumerGroupEnum.PROVISIONING,
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

    const created = await this.accountCreate.execute(parsed.data.data.userId);
    this.logger.log(`${created ? 'created' : 'skipped existing'} account for user=${parsed.data.data.userPublicId} id=${parsed.data.id}`);
  }
}
