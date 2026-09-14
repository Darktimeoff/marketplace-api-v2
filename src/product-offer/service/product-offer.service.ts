import { Injectable } from '@nestjs/common';
import {
  ProductOfferRepository,
  type QuantityChangeInterface,
  type ReservedQuantityInterface,
} from '../repository/product-offer.repository.js';
import { ProductOffer } from '../../entities/product-offer.entity.js';

@Injectable()
export class ProductOfferService {
  constructor(private readonly productOfferRepository: ProductOfferRepository) {}

  findByIds(ids: ProductOffer['id'][]): Promise<ProductOffer[]> {
    return this.productOfferRepository.findByIds(ids);
  }

  reserveQuantityByIds(reservations: QuantityChangeInterface[]): Promise<ReservedQuantityInterface[]> {
    return this.productOfferRepository.reserveQuantityByIds(reservations);
  }
}
