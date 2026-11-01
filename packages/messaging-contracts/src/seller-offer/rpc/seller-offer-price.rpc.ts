import type { CurrencyEnum } from '@marketplace/contracts-core';

export namespace SellerOfferPriceRpc {
  export const METHOD = 'seller-offer.price';

  export interface RequestInterface {
    offerPublicIds: string[];
  }

  export interface OfferPriceInterface {
    offerPublicId: string;
    price: string;
    discountPrice: string | null;
    currency: CurrencyEnum;
  }

  export interface ResponseInterface {
    offers: OfferPriceInterface[];
  }
}
