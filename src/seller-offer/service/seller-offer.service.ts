import { Injectable } from '@nestjs/common';
import {
  SellerOfferRepository,
  type QuantityChangeInterface,
  type ReservedQuantityInterface,
} from '../repository/seller-offer.repository.js';
import { SellerOffer } from '../entity/seller-offer.entity.js';

@Injectable()
export class SellerOfferService {
  constructor(private readonly sellerOfferRepository: SellerOfferRepository) {}

  findByIds(ids: SellerOffer['id'][]): Promise<SellerOffer[]> {
    return this.sellerOfferRepository.findByIds(ids);
  }

  reserveQuantityByIds(reservations: QuantityChangeInterface[]): Promise<ReservedQuantityInterface[]> {
    return this.sellerOfferRepository.reserveQuantityByIds(reservations);
  }
}
