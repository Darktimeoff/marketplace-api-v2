import { Nack, RabbitRPC } from "@golevelup/nestjs-rabbitmq";
import { StockReserveRequest } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { SellerOfferReserveTopologyEnum } from "../enum/seller-offer-reserve-topology.enum.js";
import { SellerOfferService } from "../service/seller-offer.service.js";
import { StockReservationRejectedException } from "../exception/stock-reservation-rejected.exception.js";

@Injectable()
export class OrderSellerOfferGateway {
  private readonly logger = new Logger(OrderSellerOfferGateway.name)

  constructor(private readonly offers: SellerOfferService) {}

  @RabbitRPC({
    exchange: StockReserveRequest.TOPIC,
    routingKey: StockReserveRequest.TYPE,
    queue: SellerOfferReserveTopologyEnum.QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': SellerOfferReserveTopologyEnum.DLX,
        'x-dead-letter-routing-key': SellerOfferReserveTopologyEnum.QUEUE
      },
      consumerOptions: {
        noAck: false
      }
    }
  })
  async handleStockReserve(msg: StockReserveRequest.MessageType): Promise<StockReserveRequest.ResponseMessageType | Nack> {
    if (msg?.specversion !== '1.0' || msg.type !== StockReserveRequest.TYPE || typeof msg.subject !== 'string' || !isUUID(msg.subject) || !Array.isArray(msg.data?.items) || msg.data.items.length === 0) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    try {
      await this.offers.reserveOrFail(msg.subject, msg.data.items)
      return this.toResponse(msg, { status: 'reserved' })
    } catch (e) {
      if (e instanceof StockReservationRejectedException) {
        return this.toResponse(msg, { status: 'rejected', reason: e.reason, items: e.items })
      }

      throw e
    }
  }

  private toResponse(
    request: StockReserveRequest.MessageType,
    data: StockReserveRequest.ResponseDataType,
  ): StockReserveRequest.ResponseMessageType {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: StockReserveRequest.RESPONSE_SOURCE,
      type: StockReserveRequest.RESPONSE_TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: request.subject,
      correlationid: request.id,
      data,
    }
  }
}
