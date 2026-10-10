import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { SellerOffer } from '../entity/seller-offer.entity.js';

@Injectable()
export class SellerOfferRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByIds(ids: SellerOffer['id'][]): Promise<SellerOffer[]> {
    const sellerOffers = this.txHost.tx.getRepository(SellerOffer);
    return sellerOffers.findBy({ id: In(ids) });
  }
}
