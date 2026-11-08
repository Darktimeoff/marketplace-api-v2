import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { MediaVariantsGeneratedEvent } from '@marketplace/messaging-contracts';
import { ProductMediaRepository } from '../repository/product-media.repository.js';
import { ProductMediaVariantRepository } from '../repository/product-media-variant.repository.js';
import type { ProductMedia } from '../entity/product-media.entity.js';
import type { ProductMediaVariantCreateEntityInterface } from '../entity/product-media-variant.entity.js';

@Injectable()
export class ProductMediaVariantsSaveCommandHandler {
  private readonly logger = new Logger(ProductMediaVariantsSaveCommandHandler.name);

  constructor(
    private readonly productMedia: ProductMediaRepository,
    private readonly variants: ProductMediaVariantRepository,
  ) {}

  @Transactional()
  async execute(data: Pick<MediaVariantsGeneratedEvent.DataInterface, 'mediaPublicId' | 'thumbHash' | 'variants'>): Promise<void> {
    const media = await this.productMedia.findByMediaPublicId(data.mediaPublicId);

    if (!media) {
      this.logger.warn(`skipped variants media=${data.mediaPublicId}: not attached to a product`);
      return;
    }

    await this.variants.createManyIgnoringExisting(this.toVariants(media, data.variants));
    await this.productMedia.setThumbHash(media.id, data.thumbHash);
    this.logger.log(`saved ${data.variants.length} variants media=${data.mediaPublicId}`);
  }

  private toVariants(media: ProductMedia, variants: MediaVariantsGeneratedEvent.VariantInterface[]): ProductMediaVariantCreateEntityInterface[] {
    return variants.map((variant) => ({
      productMediaId: media.id,
      name: variant.name,
      mimeType: variant.mimeType,
      storageKey: variant.storageKey,
      width: variant.width,
      height: variant.height,
    }));
  }
}
