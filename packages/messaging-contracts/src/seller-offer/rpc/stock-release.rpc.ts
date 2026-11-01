export namespace StockReleaseRpc {
  export const METHOD = 'seller-offer.stock.release';

  export interface RequestInterface {
    orderPublicId: string;
  }

  export type ResponseType = { status: 'released'; offers: number };
}
