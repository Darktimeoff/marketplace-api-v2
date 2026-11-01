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
}
