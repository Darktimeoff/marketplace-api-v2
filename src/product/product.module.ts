import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entity/product.entity.js';
import { ProductTranslation } from './entity/product-translation.entity.js';
import { ProductMedia } from './entity/product-media.entity.js';
import { ProductOutbox } from './entity/product-outbox.entity.js';
import { ProductRepository } from './repository/product.repository.js';
import { ProductTranslationRepository } from './repository/product-translation.repository.js';
import { ProductMediaRepository } from './repository/product-media.repository.js';
import { ProductOutboxRepository } from './repository/product-outbox.repository.js';
import { ProductCreateCommandHandler } from './command-handler/product-create.command-handler.js';
import { ProductController } from './controller/product.controller.js';
import { ProductMessage } from './message/product.message.js';
import { ProductResponse } from './response/product.response.js';
import { ProductOutboxRelay } from './relay/product-outbox.relay.js';
import { ProductOutboxCleanupCron } from './cron/product-outbox-cleanup.cron.js';
import { MediaClient } from './client/media.client.js';
import { MEDIA_CLIENT } from './constant/product-client.constant.js';
import { MediaModule } from '../media/media.module.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { QueueModule } from '../generic/queue/queue.module.js';
import { CategoryModule } from '../category/category.module.js';
import { BrandModule } from '../brand/brand.module.js';
import { MessagingModule } from '../generic/messaging/messaging.module.js';
import { ProductMediaVariant } from './entity/product-media-variant.entity.js';
import { ProductMediaVariantRepository } from './repository/product-media-variant.repository.js';
import { ProductMediaVariantsSaveCommandHandler } from './command-handler/product-media-variants-save.command-handler.js';
import { ProductMediaEventsConsumer } from './consumer/product-media-events.consumer.js';
import { ProductService } from './service/product.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductTranslation, ProductMedia, ProductMediaVariant, ProductOutbox]), MediaModule, KafkaModule, MessagingModule, QueueModule, CategoryModule, BrandModule],
  controllers: [ProductController],
  providers: [
    ProductRepository,
    ProductTranslationRepository,
    ProductMediaRepository,
    ProductMediaVariantRepository,
    ProductMediaVariantsSaveCommandHandler,
    ProductMediaEventsConsumer,
    ProductService,
    ProductOutboxRepository,
    ProductCreateCommandHandler,
    ProductMessage,
    ProductResponse,
    ProductOutboxRelay,
    ProductOutboxCleanupCron,
    { provide: MEDIA_CLIENT, useClass: MediaClient },
  ],
})
export class ProductModule {}
