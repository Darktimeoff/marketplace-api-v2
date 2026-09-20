import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../repository/product.repository.js';
import { ProductNotFoundException } from '../exception/product-not-found.exception.js';
import { LanguageEnum } from '../../entities/enums.js';
import type { ProductDetailResultInterface } from '../interface/product-detail.interface.js';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async getDetailById(id: number): Promise<ProductDetailResultInterface> {
    const core = await this.productRepository.findCoreById(id, LanguageEnum.en);

    if (!core) {
      throw new ProductNotFoundException(id);
    }

    const [offers, breadcrumbs] = await Promise.all([
      this.productRepository.findOffersByProductId(core.id),
      this.productRepository.findCategoryBreadcrumbs(
        core.categoryId,
        LanguageEnum.en,
      ),
    ]);

    return {
      product: {
        title: core.title,
        slug: core.slug,
        brand: core.brandSlug
          ? { name: core.brandName!, slug: core.brandSlug }
          : null,
        offers,
      },
      breadcrumbs,
    };
  }
}
