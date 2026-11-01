import type { SellerOfferPriceRpc } from '@marketplace/messaging-contracts';

export interface SellerOfferClientInterface {
  findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface>;
}
