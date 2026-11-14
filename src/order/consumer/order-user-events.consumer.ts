import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TopicEnum, UserCreatedEvent } from '@marketplace/messaging-contracts';
import { EVENT_SUBSCRIBER } from '../../generic/messaging/constant/messaging.constant.js';
import { EventRejectedException } from '../../generic/messaging/exception/event-rejected.exception.js';
import type { EventSubscriberInterface } from '../../generic/messaging/interface/event-subscriber.interface.js';
import { OrderBuyerRegisterCommandHandler } from '../command-handler/order-buyer-register.command-handler.js';
import { OrderConsumerGroupEnum } from '../enum/order-consumer-group.enum.js';
import { userCreatedEventSchema } from '../schema/user-created-event.schema.js';

@Injectable()
export class OrderUserEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(OrderUserEventsConsumer.name);

  constructor(
    @Inject(EVENT_SUBSCRIBER) private readonly consumer: EventSubscriberInterface,
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
      throw new EventRejectedException(parsed.error.message);
    }

    const { publicId } = parsed.data.data;

    if (!publicId) {
      this.logger.debug(`skipped id=${parsed.data.id}: event predates the person publicId, the buyer was back-filled by migration`);
      return;
    }

    const registered = await this.buyerRegister.execute({ publicId });
    this.logger.log(`${registered ? 'registered' : 'skipped existing'} buyer for person=${publicId} id=${parsed.data.id}`);
  }
}
