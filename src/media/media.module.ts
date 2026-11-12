import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../generic/storage/storage.module.js';
import { QueueModule } from '../generic/queue/queue.module.js';
import { Media } from './entity/media.entity.js';
import { MediaVariant } from './entity/media-variant.entity.js';
import { MediaOutbox } from './entity/media-outbox.entity.js';
import { MediaOutboxRepository } from './repository/media-outbox.repository.js';
import { MediaOutboxRelay } from './relay/media-outbox.relay.js';
import { MediaOutboxCleanupCron } from './cron/media-outbox-cleanup.cron.js';
import { MediaThumbHashService } from './service/media-thumbhash.service.js';
import { MediaVariantRepository } from './repository/media-variant.repository.js';
import { MediaImageVariantService } from './service/media-image-variant.service.js';
import { MediaVideoVariantService } from './service/media-video-variant.service.js';
import { MediaVariantEncoderResolverService } from './service/media-variant-encoder-resolver.service.js';
import { MediaVariantsGenerateCommandHandler } from './command-handler/media-variants-generate.command-handler.js';
import { MediaVariantsJob } from './job/media-variants.job.js';
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
import { MessagingModule } from '../generic/messaging/messaging.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Media, MediaVariant, MediaOutbox]), StorageModule, QueueModule, MessagingModule],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    MediaOutboxRepository,
    MediaOutboxRelay,
    MediaOutboxCleanupCron,
    MediaThumbHashService,
    MediaVariantRepository,
    MediaImageVariantService,
    MediaVideoVariantService,
    MediaVariantEncoderResolverService,
    MediaVariantsGenerateCommandHandler,
    MediaVariantsJob,
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
