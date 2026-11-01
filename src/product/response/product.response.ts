import { Injectable } from '@nestjs/common';
import type { ProductResponseInterface } from '@marketplace/contracts-core';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import type { Product } from '../entity/product.entity.js';
import type { ProductMedia } from '../entity/product-media.entity.js';
import type { Category } from '../../category/entity/category.entity.js';
import type { Brand } from '../../brand/entity/brand.entity.js';

@Injectable()
export class ProductResponse {
  constructor(private readonly environment: EnvironmentService) {}

  toProduct(product: Product, category: Category, brand: Brand, media: ProductMedia[]): ProductResponseInterface {
    const baseUrl = this.environment.get('MEDIA_PUBLIC_BASE_URL');

    return {
      publicId: product.publicId,
      categoryPublicId: category.publicId,
      brandPublicId: brand.publicId,
      media: media.map((item) => ({
        id: item.mediaPublicId,
        position: item.position,
        kind: item.kind,
        mimeType: item.mimeType,
        url: `${baseUrl}/${item.storageKey}`,
      })),
      createdAt: product.createdAt,
    };
  }
}
