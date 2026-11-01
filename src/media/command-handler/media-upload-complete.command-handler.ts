import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaStatusEnum, type MediaResponseInterface } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';
import { MediaResponseService } from '../service/media-response.service.js';
import { MediaPartPlanService } from '../service/media-part-plan.service.js';
import type { Media } from '../entity/media.entity.js';

@Injectable()
export class MediaUploadCompleteCommandHandler {
  private readonly logger = new Logger(MediaUploadCompleteCommandHandler.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly responses: MediaResponseService,
    private readonly plan: MediaPartPlanService,
  ) {}

  async execute(publicId: string, ownerPublicId: string): Promise<MediaResponseInterface> {
    const media = await this.media.findOwned(publicId, ownerPublicId);

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (media.status === MediaStatusEnum.READY) {
      return this.responses.toMedia(media);
    }

    if (media.status !== MediaStatusEnum.PENDING) {
      throw new ConflictException(`Media is ${media.status}`);
    }

    return this.responses.toMedia(await this.complete(media));
  }

  private async complete(media: Media): Promise<Media> {
    const stored = (await this.storage.head(media.storageKey)) ?? (media.uploadId ? await this.assemble(media, media.uploadId) : null);

    if (!stored) {
      this.logger.warn(`complete without bytes media=${media.publicId} key=${media.storageKey}`);
      throw new ConflictException('Upload has not reached the storage');
    }

    if (stored.sizeBytes !== media.sizeBytes) {
      this.logger.warn(`size mismatch media=${media.publicId} declared=${media.sizeBytes} stored=${stored.sizeBytes}`);
      throw new ConflictException(`Stored size ${stored.sizeBytes} does not match the declared ${media.sizeBytes}`);
    }

    const ready = await this.media.markPendingReady(media.id);

    if (!ready) {
      throw new ConflictException('Media is no longer pending');
    }

    this.logger.log(`upload completed media=${media.publicId} size=${stored.sizeBytes} etag=${stored.etag}`);
    return ready;
  }

  private async assemble(media: Media, uploadId: string) {
    const parts = await this.storage.listParts(media, uploadId);
    const partCount = this.plan.partCount(media.sizeBytes);

    if (parts.length < partCount) {
      this.logger.warn(`complete with missing parts media=${media.publicId} uploaded=${parts.length} expected=${partCount}`);
      throw new ConflictException(`${parts.length} of ${partCount} parts are uploaded`);
    }

    await this.storage.completeMultipartUpload(media, uploadId, parts);
    return this.storage.head(media.storageKey);
  }
}
