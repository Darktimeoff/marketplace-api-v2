import { Injectable } from '@nestjs/common';
import { SellerOfferRepository } from '../repository/seller-offer.repository.js';
import { SellerOffer } from '../entity/seller-offer.entity.js';

@Injectable()
export class SellerOfferService {
  constructor(private readonly sellerOfferRepository: SellerOfferRepository) {}

  findByPublicIds(publicIds: SellerOffer['publicId'][]): Promise<SellerOffer[]> {
    return this.sellerOfferRepository.findByPublicIds(publicIds);
  }
}
