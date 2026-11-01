import { Injectable } from '@nestjs/common';
import type { SellerOfferPriceRpc, StockReleaseRpc, StockReserveRpc } from '@marketplace/messaging-contracts';
import { SellerOfferService } from '../../seller-offer/service/seller-offer.service.js';
import { SellerOfferStockReserveCommandHandler } from '../../seller-offer/command-handler/seller-offer-stock-reserve.command-handler.js';
import { SellerOfferStockReleaseCommandHandler } from '../../seller-offer/command-handler/seller-offer-stock-release.command-handler.js';
import type { SellerOfferClientInterface } from './seller-offer.client.interface.js';

@Injectable()
export class SellerOfferClient implements SellerOfferClientInterface {
  constructor(
    private readonly sellerOffers: SellerOfferService,
    private readonly stockReserve: SellerOfferStockReserveCommandHandler,
    private readonly stockRelease: SellerOfferStockReleaseCommandHandler,
  ) {}

  findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface> {
    return this.sellerOffers.findPrices(request);
  }

  reserveStock(request: StockReserveRpc.RequestInterface): Promise<StockReserveRpc.ResponseType> {
    return this.stockReserve.execute(request);
  }

  releaseStock(request: StockReleaseRpc.RequestInterface): Promise<StockReleaseRpc.ResponseType> {
    return this.stockRelease.execute(request);
  }
}
