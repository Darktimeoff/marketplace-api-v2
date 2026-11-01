import { describe, expect, it } from 'vitest';
import { ProductCreatedEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { ProductMessageService } from '../../src/product/service/product-message.service.js';
import { ProductOutboxAggregateTypeEnum } from '../../src/product/enum/product-outbox-aggregate-type.enum.js';
import type { Product } from '../../src/product/entity/product.entity.js';
import type { ProductMedia } from '../../src/product/entity/product-media.entity.js';

const product = {
  id: 12,
  publicId: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
} as Product;

describe('ProductMessageService', () => {
  it('builds the product.created outbox row keyed by the product publicId', () => {
    const media = [{ mediaPublicId: 'aaaaaaaa-0000-4000-8000-000000000001' }, { mediaPublicId: 'aaaaaaaa-0000-4000-8000-000000000002' }] as ProductMedia[];

    expect(new ProductMessageService().toProductCreatedOutbox(product, media)).toEqual({
      id: product.publicId,
      topic: TopicEnum.PRODUCT_EVENTS,
      aggregateType: ProductOutboxAggregateTypeEnum.PRODUCT,
      aggregateId: product.publicId,
      type: ProductCreatedEvent.TYPE,
      payload: {
        productPublicId: product.publicId,
        mediaIds: ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'],
        createdAt: '2026-11-01T10:00:00.000Z',
      },
    });
  });

  it('keeps the integer product id out of the event', () => {
    const payload = new ProductMessageService().toProductCreatedOutbox(product, []).payload;

    expect(payload).toEqual({ productPublicId: product.publicId, mediaIds: [], createdAt: '2026-11-01T10:00:00.000Z' });
  });
});
