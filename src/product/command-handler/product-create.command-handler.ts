import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { QueryFailedError } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MediaAttachmentTypeEnum, MediaClaimStatusEnum, type ProductResponseInterface } from '@marketplace/contracts-core';
import type { MediaClaimRpc } from '@marketplace/messaging-contracts';
import { ProductRepository } from '../repository/product.repository.js';
import { ProductTranslationRepository } from '../repository/product-translation.repository.js';
import { ProductMediaRepository } from '../repository/product-media.repository.js';
import { ProductOutboxRepository } from '../repository/product-outbox.repository.js';
import { ProductMessageService } from '../service/product-message.service.js';
import { ProductResponseService } from '../service/product-response.service.js';
import { ProductCreateInput } from '../input/product-create.input.js';
import { MEDIA_CLIENT } from '../constant/product-client.constant.js';
import type { MediaClientInterface } from '../client/media.client.interface.js';
import type { Product } from '../entity/product.entity.js';
import type { ProductMediaCreateEntityInterface } from '../entity/product-media.entity.js';

@Injectable()
export class ProductCreateCommandHandler {
  private readonly foreignKeyViolation = '23503';

  constructor(
    private readonly products: ProductRepository,
    private readonly translations: ProductTranslationRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly outbox: ProductOutboxRepository,
    private readonly messages: ProductMessageService,
    private readonly responses: ProductResponseService,
    @Inject(MEDIA_CLIENT) private readonly mediaClient: MediaClientInterface,
  ) {}

  async execute(input: ProductCreateInput, identityPublicId: string): Promise<ProductResponseInterface> {
    const publicId = randomUUID();
    const media = await this.claimMedia(input.mediaIds ?? [], identityPublicId, publicId);

    try {
      return await this.create(input, publicId, media);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === this.foreignKeyViolation) {
        throw new NotFoundException('Category or brand not found');
      }

      throw error;
    }
  }

  private async claimMedia(mediaIds: string[], ownerPublicId: string, productPublicId: string): Promise<MediaClaimRpc.ClaimedMediaInterface[]> {
    if (mediaIds.length === 0) {
      return [];
    }

    const claim = await this.mediaClient.claim({
      ownerPublicId,
      mediaIds,
      attachTo: { type: MediaAttachmentTypeEnum.PRODUCT, id: productPublicId },
    });

    if (claim.status === MediaClaimStatusEnum.REJECTED) {
      throw new ConflictException(`Media not available: ${claim.rejectedMediaIds.join(', ')}`);
    }

    return claim.media;
  }

  @Transactional()
  private async create(input: ProductCreateInput, publicId: string, media: MediaClaimRpc.ClaimedMediaInterface[]): Promise<ProductResponseInterface> {
    const product = await this.products.create({ publicId, categoryId: input.categoryId, brandId: input.brandId });
    await this.translations.create(
      input.translations.map(({ language, title, description }) => ({ productId: product.id, language, title, description: description ?? null })),
    );
    const productMedia = await this.productMedia.createMany(this.toProductMedia(product, media));
    await this.outbox.create(this.messages.toProductCreatedOutbox(product, productMedia));
    return this.responses.toProduct(product, productMedia);
  }

  private toProductMedia(product: Product, media: MediaClaimRpc.ClaimedMediaInterface[]): ProductMediaCreateEntityInterface[] {
    return media.map((item, position) => ({
      productId: product.id,
      mediaPublicId: item.id,
      position,
      kind: item.kind,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      storageKey: item.storageKey,
    }));
  }
}
