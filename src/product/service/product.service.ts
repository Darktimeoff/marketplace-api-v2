import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../repository/product.repository.js';
import { ProductNotFoundException } from '../exception/product-not-found.exception.js';
import { LanguageEnum } from '../../generic/enum/enums.js';
import type { ProductDetailResultInterface, SellerOfferRowInterface } from '../interface/product-detail.interface.js';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async getDetailById(id: number): Promise<ProductDetailResultInterface> {
    const core = await this.productRepository.findCoreById(id, LanguageEnum.en);

    if (!core) {
      throw new ProductNotFoundException(id);
    }

    const variants = await this.productRepository.findVariantsByProductId(core.id);
    const offers = await this.productRepository.findOffersByVariantIds(variants.map((variant) => variant.id));
    const breadcrumbs = await this.productRepository.findCategoryBreadcrumbs(
      core.categoryId,
      LanguageEnum.en,
    );

    const offersByVariantId = new Map<number, SellerOfferRowInterface[]>();

    for (const offer of offers) {
      const existing = offersByVariantId.get(offer.variantId);

      if (existing) {
        existing.push(offer);
      } else {
        offersByVariantId.set(offer.variantId, [offer]);
      }
    }

    return {
      product: {
        title: core.title,
        brand: core.brandSlug
          ? { name: core.brandName!, slug: core.brandSlug }
          : null,
        variants: variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          slug: variant.slug,
          barcode: variant.barcode,
          offers: offersByVariantId.get(variant.id) ?? [],
        })),
      },
      breadcrumbs,
    };
  }
}
