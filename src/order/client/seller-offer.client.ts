import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { StockReleaseRequest, StockReserveRequest, type SellerOfferPriceRpc } from '@marketplace/messaging-contracts';
import { SellerOfferService } from '../../seller-offer/service/seller-offer.service.js';
import { OrderPlaceMessage } from '../message/order-place.message.js';
import type { SellerOfferClientInterface } from './seller-offer.client.interface.js';

@Injectable()
export class SellerOfferClient implements SellerOfferClientInterface {
  private readonly rpcTimeoutMs = 5000;

  constructor(
    private readonly sellerOffers: SellerOfferService,
    private readonly amqpConnection: AmqpConnection,
    private readonly messages: OrderPlaceMessage,
  ) {}

  findPrices(request: SellerOfferPriceRpc.RequestInterface): Promise<SellerOfferPriceRpc.ResponseInterface> {
    return this.sellerOffers.findPrices(request);
  }

  async reserveStock(request: StockReserveRequest.DataInterface): Promise<StockReserveRequest.ResponseDataType> {
    const { data } = await this.amqpConnection.request<StockReserveRequest.ResponseMessageType>({
      exchange: StockReserveRequest.TOPIC,
      routingKey: StockReserveRequest.TYPE,
      payload: this.messages.toStockReserveRequest(request),
      timeout: this.rpcTimeoutMs,
      expiration: this.rpcTimeoutMs,
    });

    return data;
  }

  async releaseStock(request: StockReleaseRequest.DataInterface): Promise<StockReleaseRequest.ResponseDataType> {
    const { data } = await this.amqpConnection.request<StockReleaseRequest.ResponseMessageType>({
      exchange: StockReleaseRequest.TOPIC,
      routingKey: StockReleaseRequest.TYPE,
      payload: this.messages.toStockReleaseRequest(request),
      timeout: this.rpcTimeoutMs,
      expiration: this.rpcTimeoutMs,
    });

    return data;
  }
}
