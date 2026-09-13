import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductOffer } from '../../entities/product-offer.entity.js';

@Injectable()
export class ProductOfferRepository {
  constructor(
    @InjectRepository(ProductOffer) private readonly productOffers: Repository<ProductOffer>,
  ) {}

  findByIds(ids: number[]): Promise<ProductOffer[]> {
    return this.productOffers.findBy({ id: In(ids) });
  }
}
