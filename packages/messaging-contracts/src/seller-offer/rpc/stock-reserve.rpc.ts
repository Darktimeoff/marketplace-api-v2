export namespace StockReserveRpc {
  export const METHOD = 'seller-offer.stock.reserve';

  export interface ItemInterface {
    offerPublicId: string;
    quantity: number;
  }

  export interface RequestInterface {
    orderPublicId: string;
    items: ItemInterface[];
  }

  export type ResponseType =
    | { status: 'reserved' }
    | { status: 'rejected'; reason: 'insufficient_stock' | 'offer_not_found'; items: (ItemInterface & { available: number })[] };
}
