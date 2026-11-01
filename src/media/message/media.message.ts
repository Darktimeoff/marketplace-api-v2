import { Injectable } from '@nestjs/common';
import { MediaClaimStatusEnum } from '@marketplace/contracts-core';
import type { MediaClaimRpc } from '@marketplace/messaging-contracts';
import type { Media } from '../entity/media.entity.js';

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
}
