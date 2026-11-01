import type { SellerOfferPriceRpc, StockReleaseRpc, StockReserveRpc } from '@marketplace/messaging-contracts';

export interface SellerOfferClientInterface {
  findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface>;
  reserveStock(request: StockReserveRpc.RequestInterface): Promise<StockReserveRpc.ResponseType>;
  releaseStock(request: StockReleaseRpc.RequestInterface): Promise<StockReleaseRpc.ResponseType>;
}
