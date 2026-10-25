import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Product, type ProductCreateEntityInterface } from '../entity/product.entity.js';

@Injectable()
export class ProductRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: ProductCreateEntityInterface): Promise<Product> {
    const products = this.txHost.tx.getRepository(Product);
    return products.save(products.create(input));
  }
}
