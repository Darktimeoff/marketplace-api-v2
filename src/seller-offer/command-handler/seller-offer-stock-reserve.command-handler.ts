import { StockReserveRequest } from "@marketplace/messaging-contracts";
import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { SellerOfferRepository } from "../repository/seller-offer.repository.js";
import { StockReservationRepository } from "../repository/stock-reservation.repository.js";
import { StockReservationRejectedException } from "../exception/stock-reservation-rejected.exception.js";

@Injectable()
export class SellerOfferStockReserveCommandHandler {
  constructor(
    private readonly offers: SellerOfferRepository,
    private readonly reservations: StockReservationRepository,
  ) {}

  @Transactional()
  async execute(orderPublicId: string, { items }: StockReserveRequest.DataInterface): Promise<void> {
    const offers = await this.offers.findByIds(items.map((item) => item.offerId));
    const offerIds = new Set(offers.map((offer) => offer.id));
    const missing = items.filter((item) => !offerIds.has(item.offerId));

    if (missing.length > 0) {
      throw new StockReservationRejectedException(
        'offer_not_found',
        missing.map((item) => ({ ...item, available: 0 })),
      );
    }

    const outcomes = await this.reservations.reserve(
      items.map((item) => ({ orderPublicId, offerId: item.offerId, quantity: item.quantity })),
    );
    const failedIds = new Set(
      outcomes.filter((outcome) => outcome.inserted > 0 && outcome.held === 0).map((outcome) => outcome.offerId),
    );

    if (failedIds.size === 0) {
      return;
    }

    const stockById = new Map(offers.map((offer) => [offer.id, offer.onHandQuantity - offer.reservedQuantity]));

    throw new StockReservationRejectedException(
      'insufficient_stock',
      items
        .filter((item) => failedIds.has(item.offerId))
        .map((item) => ({ ...item, available: stockById.get(item.offerId) ?? 0 })),
    );
  }
}
