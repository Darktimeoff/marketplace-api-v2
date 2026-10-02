import { Nack, RabbitRPC, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { StockReleaseCommand, StockReserveRequest } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { SellerOfferReserveTopologyEnum } from "../enum/seller-offer-reserve-topology.enum.js";
import { SellerOfferReleaseTopologyEnum } from "../enum/seller-offer-release-topology.enum.js";
import { SellerOfferStockReserveCommandHandler } from "../command-handler/seller-offer-stock-reserve.command-handler.js";
import { SellerOfferStockReleaseCommandHandler } from "../command-handler/seller-offer-stock-release.command-handler.js";
import { StockReservationRejectedException } from "../exception/stock-reservation-rejected.exception.js";

@Injectable()
export class SellerOfferGateway {
  private readonly logger = new Logger(SellerOfferGateway.name)

  constructor(
    private readonly reserve: SellerOfferStockReserveCommandHandler,
    private readonly release: SellerOfferStockReleaseCommandHandler,
  ) {}

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
      await this.reserve.execute(msg.subject, msg.data)
      return this.toResponse(msg, { status: 'reserved' })
    } catch (e) {
      if (e instanceof StockReservationRejectedException) {
        return this.toResponse(msg, { status: 'rejected', reason: e.reason, items: e.items })
      }

      throw e
    }
  }

  @RabbitSubscribe({
    exchange: StockReleaseCommand.TOPIC,
    routingKey: StockReleaseCommand.TYPE,
    queue: SellerOfferReleaseTopologyEnum.QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': SellerOfferReleaseTopologyEnum.DLX,
        'x-dead-letter-routing-key': SellerOfferReleaseTopologyEnum.QUEUE
      },
      consumerOptions: {
        noAck: false
      }
    }
  })
  async handleStockRelease(msg: StockReleaseCommand.MessageType): Promise<Nack | void> {
    if (msg?.specversion !== '1.0' || msg.type !== StockReleaseCommand.TYPE || typeof msg.data?.orderPublicId !== 'string' || !isUUID(msg.data.orderPublicId)) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    try {
      const released = await this.release.execute(msg.data)
      this.logger.log(`released order=${msg.data.orderPublicId} offers=${released}`)
    } catch (e) {
      this.logger.error(`failed release order=${msg.data.orderPublicId}`, e instanceof Error ? e.stack : String(e))
      return new Nack(true)
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
