import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Log } from '../../generic/decorator/log.decorator.js';
import { IdentityRegisteredEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { EVENT_SUBSCRIBER } from '../../generic/messaging/constant/messaging.constant.js';
import { EventRejectedException } from '../../generic/messaging/exception/event-rejected.exception.js';
import type { EventSubscriberInterface } from '../../generic/messaging/interface/event-subscriber.interface.js';
import { UserCreateCommandHandler } from '../command-handler/user-create.command-handler.js';
import { UserConsumerGroupEnum } from '../enum/user-consumer-group.enum.js';
import { identityRegisteredEventSchema } from '../schema/identity-registered-event.schema.js';

@Injectable()
export class UserIdentityEventsConsumer implements OnModuleInit {

  constructor(
    @Inject(EVENT_SUBSCRIBER) private readonly consumer: EventSubscriberInterface,
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
      throw new EventRejectedException(parsed.error.message);
    }

    const { publicId, email, phoneNumber } = parsed.data.data;
    await this.createUser({ publicId, email, phoneNumber }, parsed.data.id);
  }

  @Log(undefined, (_result, input, eventId) => `created user for person=${input.publicId} id=${eventId}`)
  private createUser(input: Parameters<UserCreateCommandHandler['execute']>[0], _eventId: string): Promise<void> {
    return this.userCreate.execute(input);
  }
}
