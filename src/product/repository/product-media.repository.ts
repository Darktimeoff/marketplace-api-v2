import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ProductMedia, type ProductMediaCreateEntityInterface } from '../entity/product-media.entity.js';

@Injectable()
export class ProductMediaRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  createMany(input: ProductMediaCreateEntityInterface[]): Promise<ProductMedia[]> {
    const media = this.txHost.tx.getRepository(ProductMedia);
    return media.save(media.create(input));
  }

  findByMediaPublicId(mediaPublicId: ProductMedia['mediaPublicId']): Promise<ProductMedia | null> {
    return this.txHost.tx.getRepository(ProductMedia).findOneBy({ mediaPublicId });
  }

  findByProductIdWithVariants(productId: ProductMedia['productId']): Promise<ProductMedia[]> {
    return this.txHost.tx.getRepository(ProductMedia).find({
      where: { productId },
      relations: { variants: true },
      order: { position: 'ASC', variants: { name: 'ASC' } },
    });
  }

  async setThumbHash(id: ProductMedia['id'], thumbHash: string): Promise<void> {
    await this.txHost.tx.getRepository(ProductMedia).update({ id }, { thumbHash });
  }
}
