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
    const offers = await this.offers.findByPublicIds(items.map((item) => item.offerPublicId));
    const offersByPublicId = new Map(offers.map((offer) => [offer.publicId, offer]));
    const missing = items.filter((item) => !offersByPublicId.has(item.offerPublicId));

    if (missing.length > 0) {
      throw new StockReservationRejectedException(
        'offer_not_found',
        missing.map((item) => ({ ...item, available: 0 })),
      );
    }

    const outcomes = await this.reservations.reserve(
      items.map((item) => ({ orderPublicId, offerId: offersByPublicId.get(item.offerPublicId)!.id, quantity: item.quantity })),
    );
    const failedIds = new Set(
      outcomes.filter((outcome) => outcome.inserted > 0 && outcome.held === 0).map((outcome) => outcome.offerId),
    );

    if (failedIds.size === 0) {
      return;
    }

    throw new StockReservationRejectedException(
      'insufficient_stock',
      items
        .map((item) => ({ item, offer: offersByPublicId.get(item.offerPublicId)! }))
        .filter(({ offer }) => failedIds.has(offer.id))
        .map(({ item, offer }) => ({ ...item, available: offer.onHandQuantity - offer.reservedQuantity })),
    );
  }
}
