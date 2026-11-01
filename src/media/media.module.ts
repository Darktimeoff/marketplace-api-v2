import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../generic/storage/storage.module.js';
import { QueueModule } from '../generic/queue/queue.module.js';
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

@Module({
  imports: [TypeOrmModule.forFeature([Media]), StorageModule, QueueModule],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    MediaStorageService,
    MediaResponseService,
    MediaPartPlanService,
    MediaService,
    MediaOrphanCleanupService,
    MediaUploadRequestCommandHandler,
    MediaUploadCompleteCommandHandler,
    MediaUploadPartsCommandHandler,
  ],
})
export class MediaModule {}
