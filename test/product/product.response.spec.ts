import { describe, expect, it } from 'vitest';
import { MediaKindEnum } from '@marketplace/contracts-core';
import { ProductResponse } from '../../src/product/response/product.response.js';
import type { EnvironmentService } from '../../src/generic/environment/environment.module.js';
import type { Product } from '../../src/product/entity/product.entity.js';
import type { ProductMedia } from '../../src/product/entity/product-media.entity.js';
import type { Category } from '../../src/category/entity/category.entity.js';
import type { Brand } from '../../src/brand/entity/brand.entity.js';

function aService(baseUrl: string): ProductResponse {
  return new ProductResponse({ get: () => baseUrl } as unknown as EnvironmentService);
}

const category = { id: 1, publicId: 'c-public' } as Category;
const brand = { id: 2, publicId: 'b-public' } as Brand;
const product = { id: 3, publicId: 'p-public', categoryId: 1, brandId: 2, createdAt: new Date('2026-11-01T10:00:00.000Z') } as Product;
const media = [
  { mediaPublicId: 'm-1', position: 0, kind: MediaKindEnum.IMAGE, mimeType: 'image/png', storageKey: 'media/o/1.png' },
  { mediaPublicId: 'm-2', position: 1, kind: MediaKindEnum.VIDEO, mimeType: 'video/mp4', storageKey: 'media/o/2.mp4' },
] as ProductMedia[];

describe('ProductResponse', () => {
  it('builds media URLs on the CDN base from the copied storage key', () => {
    expect(aService('https://cdn.marketplace.example').toProduct(product, category, brand, media)).toEqual({
      publicId: 'p-public',
      categoryPublicId: 'c-public',
      brandPublicId: 'b-public',
      media: [
        { id: 'm-1', position: 0, kind: MediaKindEnum.IMAGE, mimeType: 'image/png', url: 'https://cdn.marketplace.example/media/o/1.png' },
        { id: 'm-2', position: 1, kind: MediaKindEnum.VIDEO, mimeType: 'video/mp4', url: 'https://cdn.marketplace.example/media/o/2.mp4' },
      ],
      createdAt: product.createdAt,
    });
  });

  it('moves every URL to a new CDN by configuration alone', () => {
    const [moved] = aService('http://localhost:8088').toProduct(product, category, brand, media).media;

    expect(moved.url).toBe('http://localhost:8088/media/o/1.png');
  });
});
