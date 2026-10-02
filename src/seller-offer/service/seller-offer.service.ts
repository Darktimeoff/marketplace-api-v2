import { Injectable } from '@nestjs/common';
import { SellerOfferRepository } from '../repository/seller-offer.repository.js';
import { SellerOffer } from '../entity/seller-offer.entity.js';

@Injectable()
export class SellerOfferService {
  constructor(private readonly sellerOfferRepository: SellerOfferRepository) {}

  findByIds(ids: SellerOffer['id'][]): Promise<SellerOffer[]> {
    return this.sellerOfferRepository.findByIds(ids);
  }
}
