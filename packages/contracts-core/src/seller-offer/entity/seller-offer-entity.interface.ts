import type { CurrencyEnum } from '../../generic/enum/currency.enum.js';

export interface SellerOfferEntityInterface {
  id: number;
  sellerId: number;
  variantId: number;
  sellerSku: string;
  price: string;
  currency: CurrencyEnum;
  discountPrice: string | null;
  quantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
