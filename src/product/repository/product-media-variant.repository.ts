import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ProductMediaVariant, type ProductMediaVariantCreateEntityInterface } from '../entity/product-media-variant.entity.js';

@Injectable()
export class ProductMediaVariantRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createManyIgnoringExisting(input: ProductMediaVariantCreateEntityInterface[]): Promise<void> {
    await this.txHost.tx.getRepository(ProductMediaVariant).createQueryBuilder().insert().values(input).orIgnore().execute();
  }
}
