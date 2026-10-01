import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Controller, Logger } from "@nestjs/common";
import { isUUID } from "class-validator";
import { OrderPlacedEvent } from "@marketplace/messaging-contracts";
import { RABBITMQ_QUEUE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_queue_name.constant.js";
import { RABBITMQ_EMAIL_CHANNEL_NAME } from "../../generic/rabbitmq/constant/rabbitmq_email_channel_name.constant.js";
import { EmailService } from "../service/email.service.js";
import { InboxService } from "../service/inbox.service.js";
import { ORDER_EMAIL_CONSUMER } from "../constant/order-email-consumer.constant.js";
import { RABBITMQ_EXCHANGE_EMAIL_DLX } from "../../generic/rabbitmq/constant/rabbitmq_exchange_email_dlx.constant.js";
import { RABBITMQ_ROUTING_KEY_EMAIL_DLX } from "../../generic/rabbitmq/constant/rabbitmq_routing_key_email_dlx.constant.js";

@Controller()
export class OrderEmailGateway {
  private readonly logger = new Logger(OrderEmailGateway.name)

  constructor(private readonly inbox: InboxService, private readonly emails: EmailService) {
    
  }

  @RabbitSubscribe({
    exchange: OrderPlacedEvent.TOPIC,
    routingKey: OrderPlacedEvent.TYPE,
    queue: RABBITMQ_QUEUE_NAME,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': RABBITMQ_EXCHANGE_EMAIL_DLX,
        'x-dead-letter-routing-key': RABBITMQ_ROUTING_KEY_EMAIL_DLX
      },
      channel: RABBITMQ_EMAIL_CHANNEL_NAME,
      consumerOptions: {
        noAck: false
      }
    }
  })
  async handleOrderPlaced(msg: OrderPlacedEvent.MessageType) {
    this.logger.log(`delivered id=${msg?.id}`)

    if (msg?.specversion !== '1.0' || msg.type !== OrderPlacedEvent.TYPE || !isUUID(msg.id) || !msg.data) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    try {
      const applied = await this.inbox.processOnce(
        ORDER_EMAIL_CONSUMER,
        msg.id,
        () => this.emails.sendOrderCreated(msg.data),
      )
      this.logger.log(`${applied ? 'applied' : 'skipped'} id=${msg.id}`)
    } catch (e) {
      this.logger.error(`failed id=${msg.id}`, e instanceof Error ? e.stack : String(e))
      return new Nack(true)
    }
  }
}
