import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaStatusEnum, type MediaResponseInterface } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';
import { MediaResponseService } from '../service/media-response.service.js';
import type { Media } from '../entity/media.entity.js';

@Injectable()
export class MediaUploadCompleteCommandHandler {
  private readonly logger = new Logger(MediaUploadCompleteCommandHandler.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly responses: MediaResponseService,
  ) {}

  async execute(publicId: string, ownerIdentityPublicId: string): Promise<MediaResponseInterface> {
    const media = await this.media.findOwned(publicId, ownerIdentityPublicId);

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
    const stored = await this.storage.head(media.storageKey);

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

    this.logger.log(`upload completed media=${media.publicId} size=${stored.sizeBytes}`);
    return ready;
  }
}
