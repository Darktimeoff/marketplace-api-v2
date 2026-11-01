import { Injectable } from '@nestjs/common';
import { MediaClaimStatusEnum } from '@marketplace/contracts-core';
import { MediaVariantsGeneratedEvent, MediaVariantsGenerateJob, type MediaClaimRpc } from '@marketplace/messaging-contracts';
import { randomUUID } from 'node:crypto';
import type { MediaVariantCreateEntityInterface } from '../entity/media-variant.entity.js';
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


  toVariantsGeneratedOutbox(media: Media, variants: MediaVariantCreateEntityInterface[], thumbHash: string, generatedAt: Date): MediaOutboxCreateEntityInterface {
    return {
      id: randomUUID(),
      broker: MessageBrokerEnum.KAFKA,
      topic: MediaVariantsGeneratedEvent.TOPIC,
      aggregateType: MediaOutboxAggregateTypeEnum.MEDIA,
      aggregateId: media.publicId,
      type: MediaVariantsGeneratedEvent.TYPE,
      payload: {
        mediaPublicId: media.publicId,
        thumbHash,
        variants: variants.map((variant) => ({
          name: variant.name,
          mimeType: variant.mimeType,
          storageKey: variant.storageKey,
          width: variant.width,
          height: variant.height,
        }) satisfies MediaVariantsGeneratedEvent.VariantInterface),
        generatedAt: generatedAt.toISOString(),
      } satisfies MediaVariantsGeneratedEvent.DataInterface,
    };
  }
}
