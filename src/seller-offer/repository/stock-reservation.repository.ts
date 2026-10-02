import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { StockReservationCreateEntityInterface } from '../entity/stock-reservation.entity.js';

export interface StockReservationOutcomeInterface {
  offerId: StockReservationCreateEntityInterface['offerId'];
  inserted: number;
  held: number;
}

@Injectable()
export class StockReservationRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async reserve(reservations: StockReservationCreateEntityInterface[]): Promise<StockReservationOutcomeInterface[]> {
    const outcomes: StockReservationOutcomeInterface[] = [];

    for (const { orderPublicId, offerId, quantity } of [...reservations].sort((left, right) => left.offerId - right.offerId)) {
      const [row]: { inserted: number; held: number }[] = await this.txHost.tx.query(
        `WITH inserted AS (
           INSERT INTO "StockReservation" ("orderPublicId", "offerId", "quantity")
           VALUES ($1, $2, $3)
           ON CONFLICT ("orderPublicId", "offerId") DO NOTHING
           RETURNING "offerId", "quantity"
         ), held AS (
           UPDATE "SellerOffer" AS offer
              SET "reservedQuantity" = offer."reservedQuantity" + inserted."quantity"
             FROM inserted
            WHERE offer."id" = inserted."offerId"
              AND offer."deletedAt" IS NULL
              AND offer."quantity" - offer."reservedQuantity" >= inserted."quantity"
           RETURNING offer."id"
         )
         SELECT (SELECT count(*) FROM inserted)::int AS "inserted",
                (SELECT count(*) FROM held)::int AS "held"`,
        [orderPublicId, offerId, quantity],
      );

      outcomes.push({ offerId, ...row });
    }

    return outcomes;
  }

  async release(orderPublicId: StockReservationCreateEntityInterface['orderPublicId']): Promise<number> {
    const [rows]: [{ id: number }[], number] = await this.txHost.tx.query(
      `WITH released AS (
         UPDATE "StockReservation"
            SET "status" = 'released'
          WHERE "orderPublicId" = $1
            AND "status" IN ('reserved', 'confirmed')
         RETURNING "offerId", "quantity"
       )
       UPDATE "SellerOffer" AS offer
          SET "reservedQuantity" = offer."reservedQuantity" - released."quantity"
         FROM released
        WHERE offer."id" = released."offerId"
       RETURNING offer."id"`,
      [orderPublicId],
    );

    return rows.length;
  }
}
