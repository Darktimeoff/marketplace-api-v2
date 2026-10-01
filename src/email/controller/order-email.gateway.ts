import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Controller, Logger } from "@nestjs/common";
import { isUUID } from "class-validator";
import { RABBITMQ_EXCHANGE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_exchange_name.constant.js";
import { RABBITMQ_ROUTING_KEY } from "../../generic/rabbitmq/constant/rabbitmq_routing_key.constant.js";
import { RABBITMQ_QUEUE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_queue_name.constant.js";
import { RABBITMQ_EMAIL_CHANNEL_NAME } from "../../generic/rabbitmq/constant/rabbitmq_email_channel_name.constant.js";
import type { OrderCreatedJobInterface } from "../../generic/rabbitmq/interface/order-created-job.interface.js";
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
    exchange: RABBITMQ_EXCHANGE_NAME,
    routingKey: RABBITMQ_ROUTING_KEY,
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
  async handleOrderPlaced(msg: OrderCreatedJobInterface) {
    this.logger.log(`delivered id=${msg?.id}`)

    if (!isUUID(msg?.id) || !msg.data) {
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
