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

  findByIdsForUpdate(ids: number[]): Promise<ProductOffer[]> {
    return this.txHost.tx.getRepository(ProductOffer).find({
      where: { id: In(ids) },
      lock: { mode: 'pessimistic_write' }
    })
  }

  decrementQuantityByIds(decrements: { id: number; quantity: number }[]): Promise<unknown> {
    const productOffers = this.txHost.tx.getRepository(ProductOffer);

    const params: Record<string, number> = {};
    const cases = decrements
      .map(({ id, quantity }, index) => {
        params[`id_${index}`] = id;
        params[`qty_${index}`] = quantity;

        return `WHEN :id_${index} THEN "quantity" - :qty_${index}`;
      })
      .join(' ');

    return productOffers
      .createQueryBuilder()
      .update(ProductOffer)
      .set({ quantity: () => `CASE "id" ${cases} END` })
      .whereInIds(decrements.map(({ id }) => id))
      .setParameters(params)
      .execute();
  }
}
