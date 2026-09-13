import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { ProductOffer } from '../../entities/product-offer.entity.js';

@Injectable()
export class ProductOfferRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByIds(ids: number[]): Promise<ProductOffer[]> {
    const productOffers = this.txHost.tx.getRepository(ProductOffer);
    return productOffers.findBy({ id: In(ids) });
  }
}
