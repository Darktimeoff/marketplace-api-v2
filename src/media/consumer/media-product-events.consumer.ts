import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { ProductCreatedEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { EVENT_SUBSCRIBER } from '../../generic/messaging/constant/messaging.constant.js';
import { EventRejectedException } from '../../generic/messaging/exception/event-rejected.exception.js';
import type { EventSubscriberInterface } from '../../generic/messaging/interface/event-subscriber.interface.js';
import { MediaClaimConfirmCommandHandler } from '../command-handler/media-claim-confirm.command-handler.js';
import { MediaConsumerGroupEnum } from '../enum/media-consumer-group.enum.js';
import { productCreatedEventSchema } from '../schema/product-created-event.schema.js';

@Injectable()
export class MediaProductEventsConsumer implements OnModuleInit {
  constructor(
    @Inject(EVENT_SUBSCRIBER) private readonly consumer: EventSubscriberInterface,
    private readonly claimConfirm: MediaClaimConfirmCommandHandler,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: MediaConsumerGroupEnum.ATTACHMENT,
      topic: TopicEnum.PRODUCT_EVENTS,
      handle: (event) => this.handle(event),
    });
  }

  private async handle(event: unknown): Promise<void> {
    if ((event as { type?: unknown } | null)?.type !== ProductCreatedEvent.TYPE) {
      return;
    }

    const parsed = productCreatedEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new EventRejectedException(parsed.error.message);
    }

    const { productPublicId, mediaIds } = parsed.data.data;
    await this.claimConfirm.execute(mediaIds, MediaAttachmentTypeEnum.PRODUCT, productPublicId);
  }
}
