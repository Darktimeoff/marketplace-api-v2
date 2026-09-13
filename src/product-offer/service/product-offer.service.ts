import { Injectable } from '@nestjs/common';
import { ProductOfferRepository } from '../repository/product-offer.repository.js';
import { ProductOffer } from '../../entities/product-offer.entity.js';

@Injectable()
export class ProductOfferService {
  constructor(private readonly productOfferRepository: ProductOfferRepository) {}

  findByIds(ids: number[]): Promise<ProductOffer[]> {
    return this.productOfferRepository.findByIds(ids);
  }

  findByIdsForUpdate(ids: ProductOffer['id'][]): Promise<ProductOffer[]> {
    return this.productOfferRepository.findByIdsForUpdate(ids);
  }

  decrementQuantityByIds(decrements: { id: ProductOffer['id']; quantity: number }[]): Promise<unknown> {
    return this.productOfferRepository.decrementQuantityByIds(decrements);
  }
}
