import { describe, expect, it, vi } from 'vitest';
import { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { ProductMediaEventsConsumer } from '../../src/product/consumer/product-media-events.consumer.js';
import { KafkaRejectedMessageException } from '../../src/generic/kafka/exception/kafka-rejected-message.exception.js';
import type { KafkaConsumerService } from '../../src/generic/kafka/kafka-consumer.service.js';
import type { KafkaSubscriptionInterface } from '../../src/generic/kafka/interface/kafka-subscription.interface.js';
import type { ProductMediaVariantsSaveCommandHandler } from '../../src/product/command-handler/product-media-variants-save.command-handler.js';

const mediaPublicId = 'aaaaaaaa-0000-4000-8000-000000000001';
const variant = { name: MediaVariantNameEnum.W320, mimeType: 'image/webp', storageKey: 'media/o/1/w320.webp', width: 320, height: 192 };

function aConsumer(): { save: ReturnType<typeof vi.fn>; subscription: KafkaSubscriptionInterface } {
  const save = vi.fn();
  let subscription!: KafkaSubscriptionInterface;
  const consumer = { register: (registered: KafkaSubscriptionInterface) => { subscription = registered; } } as unknown as KafkaConsumerService;
  new ProductMediaEventsConsumer(consumer, { execute: save } as unknown as ProductMediaVariantsSaveCommandHandler).onModuleInit();
  return { save, subscription };
}

function anEvent(data: object, type = 'media.variants.generated'): object {
  return { specversion: '1.0', id: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d', type, data };
}

describe('ProductMediaEventsConsumer', () => {
  it('registers the product.media-variants group on media.events', () => {
    expect(aConsumer().subscription).toMatchObject({ groupId: 'product.media-variants', topic: 'media.events' });
  });

  it('saves the variants and thumbhash of media.variants.generated', async () => {
    const { save, subscription } = aConsumer();

    await subscription.handle(anEvent({ mediaPublicId, thumbHash: 'LggS', variants: [variant], generatedAt: '2026-11-01T10:00:00.000Z' }), { partition: 0, offset: '0' });

    expect(save).toHaveBeenCalledWith({ mediaPublicId, thumbHash: 'LggS', variants: [variant] });
  });

  it('skips types it does not handle and rejects a malformed event', async () => {
    const { save, subscription } = aConsumer();

    await subscription.handle(anEvent({ mediaPublicId }, 'media.deleted'), { partition: 0, offset: '0' });
    await expect(
      subscription.handle(anEvent({ mediaPublicId, thumbHash: 'LggS', variants: [{ ...variant, name: 'w9999' }] }), { partition: 0, offset: '1' }),
    ).rejects.toBeInstanceOf(KafkaRejectedMessageException);

    expect(save).not.toHaveBeenCalled();
  });
});
