import { Injectable } from '@nestjs/common';
import type { SellerOfferPriceRpc } from '@marketplace/messaging-contracts';
import { SellerOfferService } from '../../seller-offer/service/seller-offer.service.js';
import type { SellerOfferClientInterface } from './seller-offer.client.interface.js';

@Injectable()
export class SellerOfferClient implements SellerOfferClientInterface {
  constructor(private readonly sellerOffers: SellerOfferService) {}

  findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface> {
    return this.sellerOffers.findPrices(request);
  }
}
