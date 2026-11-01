import { Injectable, OnModuleInit } from '@nestjs/common';
import { MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { ProductCreatedEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import { MediaClaimConfirmCommandHandler } from '../command-handler/media-claim-confirm.command-handler.js';
import { MediaConsumerGroupEnum } from '../enum/media-consumer-group.enum.js';
import { productCreatedEventSchema } from '../schema/product-created-event.schema.js';

@Injectable()
export class MediaProductEventsGateway implements OnModuleInit {
  constructor(
    private readonly consumer: KafkaConsumerService,
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
      throw new KafkaRejectedMessageException(parsed.error.message);
    }

    const { productPublicId, mediaIds } = parsed.data.data;
    await this.claimConfirm.execute(mediaIds, MediaAttachmentTypeEnum.PRODUCT, productPublicId);
  }
}
