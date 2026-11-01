import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProductResponseInterface } from '@marketplace/contracts-core';
import { ProductRepository } from '../repository/product.repository.js';
import { ProductMediaRepository } from '../repository/product-media.repository.js';
import { ProductResponse } from '../response/product.response.js';
import type { Product } from '../entity/product.entity.js';

@Injectable()
export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly responses: ProductResponse,
  ) {}

  async findByPublicId(publicId: Product['publicId']): Promise<ProductResponseInterface> {
    const product = await this.products.findByPublicIdWithCatalog(publicId);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.responses.toProduct(product, product.category, product.brand, await this.productMedia.findByProductIdWithVariants(product.id));
  }
}
