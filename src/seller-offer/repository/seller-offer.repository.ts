import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { SellerOffer } from '../entity/seller-offer.entity.js';

export interface QuantityChangeInterface {
  id: SellerOffer['id'];
  quantity: number;
}

export interface ReservedQuantityInterface {
  id: SellerOffer['id'];
  quantity: number;
}

@Injectable()
export class SellerOfferRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  findByIds(ids: SellerOffer['id'][]): Promise<SellerOffer[]> {
    const sellerOffers = this.txHost.tx.getRepository(SellerOffer);
    return sellerOffers.findBy({ id: In(ids) });
  }

  async reserveQuantityByIds(reservations: QuantityChangeInterface[]): Promise<ReservedQuantityInterface[]> {
    const reserved: ReservedQuantityInterface[] = [];

    for (const { id, quantity } of [...reservations].sort((left, right) => left.id - right.id)) {
      const [rows]: [ReservedQuantityInterface[], number] = await this.txHost.tx.query(
        `UPDATE "SellerOffer"
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
