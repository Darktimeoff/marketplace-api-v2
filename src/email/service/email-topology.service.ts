import { Injectable, OnModuleInit } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfirmChannel } from "amqplib";
import { OrderPlacedEvent } from "@marketplace/messaging-contracts";
import { RABBITMQ_EXCHANGE_EMAIL_DLX } from "../../generic/rabbitmq/constant/rabbitmq_exchange_email_dlx.constant.js";
import { RABBITMQ_QUEUE_EMAIL_DLQ } from "../../generic/rabbitmq/constant/rabbitmq_queue_email_dlq.constant.js";
import { RABBITMQ_ROUTING_KEY_EMAIL_DLX } from "../../generic/rabbitmq/constant/rabbitmq_routing_key_email_dlx.constant.js";

@Injectable()
export class EmailTopologyService implements OnModuleInit {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(OrderPlacedEvent.TOPIC, 'topic', { durable: true })
      await channel.assertExchange(RABBITMQ_EXCHANGE_EMAIL_DLX, 'topic', { durable: true })
      await channel.assertQueue(RABBITMQ_QUEUE_EMAIL_DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } })
      await channel.bindQueue(RABBITMQ_QUEUE_EMAIL_DLQ, RABBITMQ_EXCHANGE_EMAIL_DLX, RABBITMQ_ROUTING_KEY_EMAIL_DLX)
    })
  }
}
