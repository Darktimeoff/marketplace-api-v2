import { Injectable, OnModuleInit } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfirmChannel } from "amqplib";
import { OrderPlacedEvent } from "@marketplace/messaging-contracts";
import { EMAIL_DLX } from "../constant/email-dlx.constant.js";
import { EMAIL_ORDER_PLACED_DLQ } from "../constant/order-placed-dlq.constant.js";
import { EMAIL_ORDER_PLACED_QUEUE } from "../constant/order-placed-queue.constant.js";

@Injectable()
export class EmailTopologyService implements OnModuleInit {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(OrderPlacedEvent.TOPIC, 'topic', { durable: true })
      await channel.assertExchange(EMAIL_DLX, 'topic', { durable: true })
      await channel.assertQueue(EMAIL_ORDER_PLACED_DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } })
      await channel.bindQueue(EMAIL_ORDER_PLACED_DLQ, EMAIL_DLX, EMAIL_ORDER_PLACED_QUEUE)
    })
  }
}
