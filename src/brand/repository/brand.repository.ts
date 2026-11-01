import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Brand } from '../entity/brand.entity.js';

@Injectable()
export class BrandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByPublicId(publicId: Brand['publicId']): Promise<Brand | null> {
    return this.txHost.tx.getRepository(Brand).findOneBy({ publicId });
  }
}
