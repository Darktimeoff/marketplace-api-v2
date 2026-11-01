import { describe, expect, it } from 'vitest';
import { CurrencyEnum } from '@marketplace/contracts-core';
import { SellerOfferMessage } from '../../src/seller-offer/message/seller-offer.message.js';
import type { SellerOffer } from '../../src/seller-offer/entity/seller-offer.entity.js';

describe('SellerOfferMessage', () => {
  it('answers prices by offer publicId without internal ids or stock', () => {
    const offer = {
      id: 14,
      publicId: '45b4b670-96f8-4cc3-9a2c-a9e284bb2551',
      sellerId: 2,
      price: '175.00',
      discountPrice: '165.00',
      currency: CurrencyEnum.UAH,
      onHandQuantity: 9,
      reservedQuantity: 1,
    } as SellerOffer;

    expect(new SellerOfferMessage().toPrices([offer])).toEqual({
      offers: [{ offerPublicId: offer.publicId, price: '175.00', discountPrice: '165.00', currency: CurrencyEnum.UAH }],
    });
  });
});
