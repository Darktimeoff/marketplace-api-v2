import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../generic/storage/storage.module.js';
import { QueueModule } from '../generic/queue/queue.module.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { Media } from './entity/media.entity.js';
import { MediaRepository } from './repository/media.repository.js';
import { MediaStorageService } from './service/media-storage.service.js';
import { MediaResponseService } from './service/media-response.service.js';
import { MediaPartPlanService } from './service/media-part-plan.service.js';
import { MediaService } from './service/media.service.js';
import { MediaOrphanCleanupService } from './service/media-orphan-cleanup.service.js';
import { MediaUploadRequestCommandHandler } from './command-handler/media-upload-request.command-handler.js';
import { MediaUploadCompleteCommandHandler } from './command-handler/media-upload-complete.command-handler.js';
import { MediaUploadPartsCommandHandler } from './command-handler/media-upload-parts.command-handler.js';
import { MediaController } from './controller/media.controller.js';
import { MediaMessage } from './message/media.message.js';
import { MediaClaimReleaseService } from './service/media-claim-release.service.js';
import { MediaClaimCommandHandler } from './command-handler/media-claim.command-handler.js';
import { MediaClaimConfirmCommandHandler } from './command-handler/media-claim-confirm.command-handler.js';
import { MediaProductEventsGateway } from './gateway/media-product-events.gateway.js';

@Module({
  imports: [TypeOrmModule.forFeature([Media]), StorageModule, QueueModule, KafkaModule],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    MediaStorageService,
    MediaResponseService,
    MediaPartPlanService,
    MediaService,
    MediaOrphanCleanupService,
    MediaMessage,
    MediaClaimReleaseService,
    MediaClaimCommandHandler,
    MediaClaimConfirmCommandHandler,
    MediaProductEventsGateway,
    MediaUploadRequestCommandHandler,
    MediaUploadCompleteCommandHandler,
    MediaUploadPartsCommandHandler,
  ],
  exports: [MediaClaimCommandHandler],
})
export class MediaModule {}
