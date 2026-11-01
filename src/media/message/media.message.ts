import { Injectable } from '@nestjs/common';
import { MediaClaimStatusEnum } from '@marketplace/contracts-core';
import type { MediaClaimRpc } from '@marketplace/messaging-contracts';
import type { Media } from '../entity/media.entity.js';
import type { MediaOutboxCreateEntityInterface } from '../entity/media-outbox.entity.js';
import type { MediaVariantsGenerateInterface } from '../interface/media-variants-generate.interface.js';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';
import { MediaOutboxTypeEnum } from '../enum/media-outbox-type.enum.js';

@Injectable()
export class MediaMessage {
  toClaimed(requestedIds: Media['publicId'][], claimed: Media[]): MediaClaimRpc.ClaimedResponseInterface {
    const byId = new Map(claimed.map((media) => [media.publicId, media]));

    return {
      status: MediaClaimStatusEnum.CLAIMED,
      media: requestedIds.map((id) => byId.get(id)!).map((media) => ({
        id: media.publicId,
        kind: media.kind,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        storageKey: media.storageKey,
      }) satisfies MediaClaimRpc.ClaimedMediaInterface),
    };
  }

  toVariantsGenerateOutbox(mediaPublicId: Media['publicId']): MediaOutboxCreateEntityInterface {
    return {
      id: mediaPublicId,
      queue: MediaQueueEnum.VARIANTS,
      type: MediaOutboxTypeEnum.VARIANTS_GENERATE,
      payload: {
        mediaPublicId,
      } satisfies MediaVariantsGenerateInterface,
    };
  }
}
