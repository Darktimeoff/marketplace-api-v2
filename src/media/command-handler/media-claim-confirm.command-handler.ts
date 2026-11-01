import { Injectable, Logger } from '@nestjs/common';
import { MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';

@Injectable()
export class MediaClaimConfirmCommandHandler {
  private readonly logger = new Logger(MediaClaimConfirmCommandHandler.name);

  constructor(private readonly media: MediaRepository) {}

  async execute(mediaIds: string[], attachedToType: MediaAttachmentTypeEnum, attachedToId: string): Promise<void> {
    if (mediaIds.length === 0) {
      return;
    }

    const confirmed = await this.media.confirmClaim(mediaIds, attachedToType, attachedToId);

    if (confirmed < mediaIds.length) {
      this.logger.warn(`confirmed ${confirmed} of ${mediaIds.length} media for ${attachedToType}=${attachedToId}: the rest is attached elsewhere or gone`);
      return;
    }

    this.logger.log(`confirmed ${confirmed} media for ${attachedToType}=${attachedToId}`);
  }
}
