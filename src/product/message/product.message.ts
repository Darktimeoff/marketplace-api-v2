import { Injectable } from '@nestjs/common';
import { ProductCreatedEvent } from '@marketplace/messaging-contracts';
import type { Product } from '../entity/product.entity.js';
import type { ProductMedia } from '../entity/product-media.entity.js';
import type { ProductOutboxCreateEntityInterface } from '../entity/product-outbox.entity.js';
import { ProductOutboxAggregateTypeEnum } from '../enum/product-outbox-aggregate-type.enum.js';
import { MessageBrokerEnum } from '../../generic/messaging/enum/message-broker.enum.js';

@Injectable()
export class ProductMessage {
  toProductCreatedOutbox(product: Product, media: ProductMedia[]): ProductOutboxCreateEntityInterface {
    return {
      id: product.publicId,
      broker: MessageBrokerEnum.KAFKA,
      topic: ProductCreatedEvent.TOPIC,
      aggregateType: ProductOutboxAggregateTypeEnum.PRODUCT,
      aggregateId: product.publicId,
      type: ProductCreatedEvent.TYPE,
      payload: {
        productPublicId: product.publicId,
        mediaIds: media.map((item) => item.mediaPublicId),
        createdAt: product.createdAt.toISOString(),
      } satisfies ProductCreatedEvent.DataInterface,
    };
  }
}
