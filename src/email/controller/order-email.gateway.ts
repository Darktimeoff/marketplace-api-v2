import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Controller, Logger } from "@nestjs/common";
import { isUUID } from "class-validator";
import { OrderPlacedEvent } from "@marketplace/messaging-contracts";
import { EMAIL_ORDER_PLACED_QUEUE } from "../constant/order-placed-queue.constant.js";
import { RABBITMQ_EMAIL_CHANNEL_NAME } from "../../generic/rabbitmq/constant/rabbitmq_email_channel_name.constant.js";
import { EmailService } from "../service/email.service.js";
import { InboxService } from "../service/inbox.service.js";
import { ORDER_EMAIL_CONSUMER } from "../constant/order-email-consumer.constant.js";
import { EMAIL_DLX } from "../constant/email-dlx.constant.js";

@Controller()
export class OrderEmailGateway {
  private readonly logger = new Logger(OrderEmailGateway.name)

  constructor(private readonly inbox: InboxService, private readonly emails: EmailService) {
    
  }

  @RabbitSubscribe({
    exchange: OrderPlacedEvent.TOPIC,
    routingKey: OrderPlacedEvent.TYPE,
    queue: EMAIL_ORDER_PLACED_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': EMAIL_DLX,
        'x-dead-letter-routing-key': EMAIL_ORDER_PLACED_QUEUE
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
