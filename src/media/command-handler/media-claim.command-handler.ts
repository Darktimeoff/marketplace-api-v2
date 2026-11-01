import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { MediaClaimStatusEnum } from '@marketplace/contracts-core';
import type { MediaClaimRpc } from '@marketplace/messaging-contracts';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaMessageService } from '../service/media-message.service.js';
import { MediaClaimRejectedException } from '../exception/media-claim-rejected.exception.js';

@Injectable()
export class MediaClaimCommandHandler {
  private readonly logger = new Logger(MediaClaimCommandHandler.name);
  private readonly claimTtlSeconds = 600;

  constructor(
    private readonly media: MediaRepository,
    private readonly messages: MediaMessageService,
  ) {}

  async execute(request: MediaClaimRpc.RequestInterface): Promise<MediaClaimRpc.ResponseType> {
    try {
      const response = await this.claimAll(request);
      this.logger.log(`claimed ${request.mediaIds.length} media for ${request.attachTo.type}=${request.attachTo.id}`);
      return response;
    } catch (error) {
      if (error instanceof MediaClaimRejectedException) {
        this.logger.warn(`claim rejected for ${request.attachTo.type}=${request.attachTo.id} media=[${error.rejectedMediaIds.join(',')}]`);
        return { status: MediaClaimStatusEnum.REJECTED, rejectedMediaIds: error.rejectedMediaIds };
      }

      throw error;
    }
  }

  @Transactional()
  private async claimAll(request: MediaClaimRpc.RequestInterface): Promise<MediaClaimRpc.ClaimedResponseInterface> {
    const claimed = await this.media.claim(
      request.mediaIds,
      request.ownerIdentityPublicId,
      request.attachTo.type,
      request.attachTo.id,
      this.claimTtlSeconds,
    );
    const claimedIds = new Set(claimed.map((media) => media.publicId));
    const rejectedMediaIds = request.mediaIds.filter((id) => !claimedIds.has(id));

    if (rejectedMediaIds.length > 0) {
      throw new MediaClaimRejectedException(rejectedMediaIds);
    }

    return this.messages.toClaimed(request.mediaIds, claimed);
  }
}
