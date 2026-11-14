import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TopicEnum, UserCreatedEvent } from '@marketplace/messaging-contracts';
import { EVENT_SUBSCRIBER } from '../../generic/messaging/constant/messaging.constant.js';
import { EventRejectedException } from '../../generic/messaging/exception/event-rejected.exception.js';
import type { EventSubscriberInterface } from '../../generic/messaging/interface/event-subscriber.interface.js';
import { AccountCreateCommandHandler } from '../command-handler/account-create.command-handler.js';
import { AccountConsumerGroupEnum } from '../enum/account-consumer-group.enum.js';
import { userCreatedEventSchema } from '../schema/user-created-event.schema.js';

@Injectable()
export class AccountUserEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(AccountUserEventsConsumer.name);

  constructor(
    @Inject(EVENT_SUBSCRIBER) private readonly consumer: EventSubscriberInterface,
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
      throw new EventRejectedException(parsed.error.message);
    }

    const { publicId } = parsed.data.data;

    if (!publicId) {
      this.logger.debug(`skipped id=${parsed.data.id}: event predates the person publicId, the account was back-filled by migration`);
      return;
    }

    const created = await this.accountCreate.execute(publicId);
    this.logger.log(`${created ? 'created' : 'skipped existing'} account for person=${publicId} id=${parsed.data.id}`);
  }
}
