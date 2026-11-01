import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { subject } from '@casl/ability';
import { MediaStatusEnum } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from './media-storage.service.js';
import type { AppAbilityType } from '../../generic/auth/app-ability.type.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
  ) {}

  async downloadUrl(publicId: string, ability: AppAbilityType): Promise<string> {
    const media = await this.media.findByPublicId(publicId);

    if (!media || media.status !== MediaStatusEnum.READY) {
      throw new NotFoundException('Media not found');
    }

    if (!ability.can('read', subject('Media', { ownerIdentityPublicId: media.ownerIdentityPublicId }))) {
      this.logger.warn(`forbidden read of media=${media.publicId}`);
      throw new ForbiddenException('This media belongs to someone else');
    }

    this.logger.log(`download signed media=${media.publicId} key=${media.storageKey}`);
    return this.storage.presignDownload(media);
  }
}
