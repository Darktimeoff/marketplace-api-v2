import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { StockReserveRequest } from '@marketplace/messaging-contracts';
import { SellerOfferRepository } from '../repository/seller-offer.repository.js';
import { StockReservationRepository } from '../repository/stock-reservation.repository.js';
import { SellerOffer } from '../entity/seller-offer.entity.js';
import { StockReservationRejectedException } from '../exception/stock-reservation-rejected.exception.js';

@Injectable()
export class SellerOfferService {
  constructor(
    private readonly sellerOfferRepository: SellerOfferRepository,
    private readonly stockReservationRepository: StockReservationRepository,
  ) {}

  findByIds(ids: SellerOffer['id'][]): Promise<SellerOffer[]> {
    return this.sellerOfferRepository.findByIds(ids);
  }

  @Transactional()
  async reserveOrFail(
    orderPublicId: string,
    items: StockReserveRequest.ItemInterface[],
  ): Promise<void> {
    const offers = await this.findByIds(items.map((item) => item.offerId));
    const offerIds = new Set(offers.map((offer) => offer.id));
    const missing = items.filter((item) => !offerIds.has(item.offerId));

    if (missing.length > 0) {
      throw new StockReservationRejectedException(
        'offer_not_found',
        missing.map((item) => ({ ...item, available: 0 })),
      );
    }

    const outcomes = await this.stockReservationRepository.reserve(
      items.map((item) => ({ orderPublicId, offerId: item.offerId, quantity: item.quantity })),
    );
    const failedIds = new Set(
      outcomes.filter((outcome) => outcome.inserted > 0 && outcome.held === 0).map((outcome) => outcome.offerId),
    );

    if (failedIds.size === 0) {
      return;
    }

    const stockById = new Map(offers.map((offer) => [offer.id, offer.quantity - offer.reservedQuantity]));

    throw new StockReservationRejectedException(
      'insufficient_stock',
      items
        .filter((item) => failedIds.has(item.offerId))
        .map((item) => ({ ...item, available: stockById.get(item.offerId) ?? 0 })),
    );
  }
}
