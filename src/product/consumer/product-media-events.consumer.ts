import { Injectable, OnModuleInit } from '@nestjs/common';
import { MediaVariantsGeneratedEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { KafkaConsumerService } from '../../generic/kafka/kafka-consumer.service.js';
import { KafkaRejectedMessageException } from '../../generic/kafka/exception/kafka-rejected-message.exception.js';
import { ProductMediaVariantsSaveCommandHandler } from '../command-handler/product-media-variants-save.command-handler.js';
import { ProductConsumerGroupEnum } from '../enum/product-consumer-group.enum.js';
import { mediaVariantsGeneratedEventSchema } from '../schema/media-variants-generated-event.schema.js';

@Injectable()
export class ProductMediaEventsConsumer implements OnModuleInit {
  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly variantsSave: ProductMediaVariantsSaveCommandHandler,
  ) {}

  onModuleInit(): void {
    this.consumer.register({
      groupId: ProductConsumerGroupEnum.MEDIA_VARIANTS,
      topic: TopicEnum.MEDIA_EVENTS,
      handle: (event) => this.handle(event),
    });
  }

  private async handle(event: unknown): Promise<void> {
    if ((event as { type?: unknown } | null)?.type !== MediaVariantsGeneratedEvent.TYPE) {
      return;
    }

    const parsed = mediaVariantsGeneratedEventSchema.safeParse(event);

    if (!parsed.success) {
      throw new KafkaRejectedMessageException(parsed.error.message);
    }

    await this.variantsSave.execute(parsed.data.data);
  }
}
