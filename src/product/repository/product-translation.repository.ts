import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ProductTranslation, type ProductTranslationCreateEntityInterface } from '../entity/product-translation.entity.js';

@Injectable()
export class ProductTranslationRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(inputs: ProductTranslationCreateEntityInterface[]): Promise<void> {
    await this.txHost.tx.getRepository(ProductTranslation).insert(inputs);
  }
}
