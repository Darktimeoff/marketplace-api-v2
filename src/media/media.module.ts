import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../generic/storage/storage.module.js';
import { QueueModule } from '../generic/queue/queue.module.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { Media } from './entity/media.entity.js';
import { MediaVariant } from './entity/media-variant.entity.js';
import { MediaRepository } from './repository/media.repository.js';
import { MediaStorageService } from './service/media-storage.service.js';
import { MediaResponse } from './response/media.response.js';
import { MediaPartPlanService } from './service/media-part-plan.service.js';
import { MediaService } from './service/media.service.js';
import { MediaOrphanCleanupCron } from './cron/media-orphan-cleanup.cron.js';
import { MediaUploadRequestCommandHandler } from './command-handler/media-upload-request.command-handler.js';
import { MediaUploadCompleteCommandHandler } from './command-handler/media-upload-complete.command-handler.js';
import { MediaUploadPartsCommandHandler } from './command-handler/media-upload-parts.command-handler.js';
import { MediaController } from './controller/media.controller.js';
import { MediaMessage } from './message/media.message.js';
import { MediaClaimReleaseCron } from './cron/media-claim-release.cron.js';
import { MediaUnattachedCleanupCron } from './cron/media-unattached-cleanup.cron.js';
import { MediaClaimCommandHandler } from './command-handler/media-claim.command-handler.js';
import { MediaClaimConfirmCommandHandler } from './command-handler/media-claim-confirm.command-handler.js';
import { MediaProductEventsConsumer } from './consumer/media-product-events.consumer.js';

@Module({
  imports: [TypeOrmModule.forFeature([Media, MediaVariant]), StorageModule, QueueModule, KafkaModule],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    MediaStorageService,
    MediaResponse,
    MediaPartPlanService,
    MediaService,
    MediaOrphanCleanupCron,
    MediaMessage,
    MediaClaimReleaseCron,
    MediaUnattachedCleanupCron,
    MediaClaimCommandHandler,
    MediaClaimConfirmCommandHandler,
    MediaProductEventsConsumer,
    MediaUploadRequestCommandHandler,
    MediaUploadCompleteCommandHandler,
    MediaUploadPartsCommandHandler,
  ],
  exports: [MediaClaimCommandHandler],
})
export class MediaModule {}
