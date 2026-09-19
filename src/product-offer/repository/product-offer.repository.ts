import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { ProductOffer } from '../../entities/product-offer.entity.js';

export interface QuantityChangeInterface {
  id: ProductOffer['id'];
  quantity: number;
}

export interface ReservedQuantityInterface {
  id: ProductOffer['id'];
  quantity: number;
}

@Injectable()
export class ProductOfferRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByIds(ids: ProductOffer['id'][]): Promise<ProductOffer[]> {
    const productOffers = this.txHost.tx.getRepository(ProductOffer);
    return productOffers.findBy({ id: In(ids) });
  }

  async reserveQuantityByIds(reservations: QuantityChangeInterface[]): Promise<ReservedQuantityInterface[]> {
    const reserved: ReservedQuantityInterface[] = [];

    for (const { id, quantity } of [...reservations].sort((left, right) => left.id - right.id)) {
      const [rows]: [ReservedQuantityInterface[], number] = await this.txHost.tx.query(
        `UPDATE "ProductOffer"
            SET "quantity" = "quantity" - $2
          WHERE "id" = $1
            AND "deletedAt" IS NULL
            AND "quantity" >= $2
      RETURNING "id", "quantity"`,
        [id, quantity],
      );

      if (rows.length > 0) {
        reserved.push(rows[0]);
      }
    }

    return reserved;
  }
}
