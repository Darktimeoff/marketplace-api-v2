import { Injectable } from '@nestjs/common';
import { SellerOfferRepository } from '../repository/seller-offer.repository.js';
import type { SellerOfferPriceRpc } from '@marketplace/messaging-contracts';
import { SellerOfferMessage } from '../message/seller-offer.message.js';

@Injectable()
export class SellerOfferService {
  constructor(
    private readonly sellerOfferRepository: SellerOfferRepository,
    private readonly messages: SellerOfferMessage,
  ) {}

  async findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface> {
    return this.messages.toPrices(await this.sellerOfferRepository.findByPublicIds(request.offerPublicIds));
  }
}
