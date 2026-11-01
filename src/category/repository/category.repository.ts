import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Category } from '../entity/category.entity.js';

@Injectable()
export class CategoryRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByPublicId(publicId: Category['publicId']): Promise<Category | null> {
    return this.txHost.tx.getRepository(Category).findOneBy({ publicId });
  }
}
