import { describe, expect, it, vi } from 'vitest';
import { MediaAttachmentTypeEnum } from '@marketplace/contracts-core';
import { MediaProductEventsGateway } from '../../src/media/gateway/media-product-events.gateway.js';
import { KafkaRejectedMessageException } from '../../src/generic/kafka/exception/kafka-rejected-message.exception.js';
import type { KafkaConsumerService } from '../../src/generic/kafka/kafka-consumer.service.js';
import type { KafkaSubscriptionInterface } from '../../src/generic/kafka/interface/kafka-subscription.interface.js';
import type { MediaClaimConfirmCommandHandler } from '../../src/media/command-handler/media-claim-confirm.command-handler.js';

const productPublicId = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';
const mediaId = 'aaaaaaaa-0000-4000-8000-000000000001';

function aGateway(): { confirm: ReturnType<typeof vi.fn>; subscription: KafkaSubscriptionInterface } {
  const confirm = vi.fn();
  let subscription!: KafkaSubscriptionInterface;
  const consumer = { register: (registered: KafkaSubscriptionInterface) => { subscription = registered; } } as unknown as KafkaConsumerService;
  new MediaProductEventsGateway(consumer, { execute: confirm } as unknown as MediaClaimConfirmCommandHandler).onModuleInit();
  return { confirm, subscription };
}

function anEvent(data: object, type = 'product.created'): object {
  return { specversion: '1.0', id: productPublicId, type, data };
}

describe('MediaProductEventsGateway', () => {
  it('registers the media.attachment group on product.events', () => {
    expect(aGateway().subscription).toMatchObject({ groupId: 'media.attachment', topic: 'product.events' });
  });

  it('confirms the claim of every media in product.created', async () => {
    const { confirm, subscription } = aGateway();

    await subscription.handle(anEvent({ productPublicId, mediaIds: [mediaId], createdAt: '2026-11-01T10:00:00.000Z' }), { partition: 0, offset: '0' });

    expect(confirm).toHaveBeenCalledWith([mediaId], MediaAttachmentTypeEnum.PRODUCT, productPublicId);
  });

  it('skips types it does not handle and rejects a malformed product.created', async () => {
    const { confirm, subscription } = aGateway();

    await subscription.handle(anEvent({ productPublicId }, 'product.renamed'), { partition: 0, offset: '0' });
    await expect(subscription.handle(anEvent({ productPublicId, mediaIds: ['not-a-uuid'] }), { partition: 0, offset: '1' })).rejects.toBeInstanceOf(
      KafkaRejectedMessageException,
    );

    expect(confirm).not.toHaveBeenCalled();
  });
});
