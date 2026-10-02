import { Injectable, OnModuleInit } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfirmChannel } from "amqplib";
import { TopicEnum } from "@marketplace/messaging-contracts";
import { SellerOfferReserveTopologyEnum } from "../enum/seller-offer-reserve-topology.enum.js";


@Injectable()
export class SellerOfferTopologyService implements OnModuleInit {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(TopicEnum.SELLER_OFFER_COMMANDS, 'topic', { durable: true })
      await channel.assertExchange(SellerOfferReserveTopologyEnum.DLX, 'topic', { durable: true })
      await channel.assertQueue(SellerOfferReserveTopologyEnum.DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } })
      await channel.bindQueue(SellerOfferReserveTopologyEnum.DLQ, SellerOfferReserveTopologyEnum.DLX, SellerOfferReserveTopologyEnum.QUEUE)
    })
  }
}
