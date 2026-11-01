import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaOutboxRepository } from '../repository/media-outbox.repository.js';
import { MediaMessage } from '../message/media.message.js';

@Injectable()
export class MediaClaimConfirmCommandHandler {
  private readonly logger = new Logger(MediaClaimConfirmCommandHandler.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly outbox: MediaOutboxRepository,
    private readonly messages: MediaMessage,
  ) {}

  async execute(mediaIds: string[], attachedToType: MediaAttachmentTypeEnum, attachedToId: string): Promise<void> {
    if (mediaIds.length === 0) {
      return;
    }

    const confirmed = (await this.confirm(mediaIds, attachedToType, attachedToId)).length;

    if (confirmed < mediaIds.length) {
      this.logger.warn(`confirmed ${confirmed} of ${mediaIds.length} media for ${attachedToType}=${attachedToId}: the rest is attached elsewhere or gone`);
      return;
    }

    this.logger.log(`confirmed ${confirmed} media for ${attachedToType}=${attachedToId}`);
  }

  @Transactional()
  private async confirm(mediaIds: string[], attachedToType: MediaAttachmentTypeEnum, attachedToId: string): Promise<string[]> {
    const confirmed = await this.media.confirmClaim(mediaIds, attachedToType, attachedToId);

    if (confirmed.length > 0) {
      await this.outbox.createManyIgnoringExisting(confirmed.map((publicId) => this.messages.toVariantsGenerateOutbox(publicId)));
    }

    return confirmed;
  }
}
