import { Injectable } from '@nestjs/common';
import type { SellerOfferPriceRpc } from '@marketplace/messaging-contracts';
import type { SellerOffer } from '../entity/seller-offer.entity.js';

@Injectable()
export class SellerOfferMessage {
  toPrices(offers: SellerOffer[]): SellerOfferPriceRpc.ResponseInterface {
    return {
      offers: offers.map((offer) => ({
        offerPublicId: offer.publicId,
        price: offer.price,
        discountPrice: offer.discountPrice,
        currency: offer.currency,
      }) satisfies SellerOfferPriceRpc.OfferPriceInterface),
    };
  }
}
