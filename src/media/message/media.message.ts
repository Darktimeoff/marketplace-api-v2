import { Injectable } from '@nestjs/common';
import { MediaClaimStatusEnum } from '@marketplace/contracts-core';
import { MediaVariantsGenerateJob, type MediaClaimRpc } from '@marketplace/messaging-contracts';
import type { Media } from '../entity/media.entity.js';
import type { MediaOutboxCreateEntityInterface } from '../entity/media-outbox.entity.js';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';
import { MediaOutboxAggregateTypeEnum } from '../enum/media-outbox-aggregate-type.enum.js';
import { MessageBrokerEnum } from '../../generic/messaging/enum/message-broker.enum.js';

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
      broker: MessageBrokerEnum.RABBITMQ,
      topic: MediaQueueEnum.VARIANTS,
      aggregateType: MediaOutboxAggregateTypeEnum.MEDIA,
      aggregateId: mediaPublicId,
      type: MediaVariantsGenerateJob.TYPE,
      payload: {
        mediaPublicId,
      } satisfies MediaVariantsGenerateJob.DataInterface,
    };
  }

}
