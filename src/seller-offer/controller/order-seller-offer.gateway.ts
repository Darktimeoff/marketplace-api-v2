import { Nack, RabbitRPC } from "@golevelup/nestjs-rabbitmq";
import { OrderItemReserveCommand } from "@marketplace/messaging-contracts";
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
    exchange: OrderItemReserveCommand.TOPIC,
    routingKey: OrderItemReserveCommand.TYPE,
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
  async handleOrderItemReserve(msg: OrderItemReserveCommand.MessageType): Promise<OrderItemReserveCommand.ResponseMessageType | Nack> {
    if (msg?.specversion !== '1.0' || msg.type !== OrderItemReserveCommand.TYPE || typeof msg.subject !== 'string' || !isUUID(msg.subject) || !Array.isArray(msg.data) || msg.data.length === 0) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    try {
      await this.offers.reserveOrFail(msg.subject, msg.data)
      return this.toResponse(msg, { status: 'reserved' })
    } catch (e) {
      if (e instanceof StockReservationRejectedException) {
        return this.toResponse(msg, { status: 'rejected', reason: e.reason, items: e.items })
      }

      throw e
    }
  }

  private toResponse(
    request: OrderItemReserveCommand.MessageType,
    data: OrderItemReserveCommand.ResponseDataInterface,
  ): OrderItemReserveCommand.ResponseMessageType {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: OrderItemReserveCommand.RESPONSE_SOURCE,
      type: OrderItemReserveCommand.RESPONSE_TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: request.subject,
      correlationid: request.id,
      data,
    }
  }
}
