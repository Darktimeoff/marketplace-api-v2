import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { SellerOffer } from '../entity/seller-offer.entity.js';

@Injectable()
export class SellerOfferRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByPublicIds(publicIds: SellerOffer['publicId'][]): Promise<SellerOffer[]> {
    const sellerOffers = this.txHost.tx.getRepository(SellerOffer);
    return sellerOffers.findBy({ publicId: In(publicIds) });
  }
}
