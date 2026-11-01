import type { SellerOfferPriceRpc, StockReleaseRequest, StockReserveRequest } from '@marketplace/messaging-contracts';

export interface SellerOfferClientInterface {
  findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface>;
  reserveStock(request: StockReserveRequest.DataInterface): Promise<StockReserveRequest.ResponseDataType>;
  releaseStock(request: StockReleaseRequest.DataInterface): Promise<StockReleaseRequest.ResponseDataType>;
}
