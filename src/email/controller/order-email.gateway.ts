import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Controller } from "@nestjs/common";
import { RABBITMQ_EXCHANGE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_exchange_name.constant.js";
import { RABBITMQ_ROUTING_KEY } from "../../generic/rabbitmq/constant/rabbitmq_routing_key.constant.js";
import { RABBITMQ_QUEUE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_queue_name.constant.js";
import { EmailInboxRepository } from "../repository/email-inbox.repository.js";
import { Transactional } from "@nestjs-cls/transactional";
import type { OrderCreatedJobInterface } from "../../generic/rabbitmq/interface/order-created-job.interface.js";
import { EmailService } from "../service/email.service.js";

@Controller()
export class OrderEmailGateway {
  constructor(private readonly inbox: EmailInboxRepository, private readonly emails: EmailService) {
    
  }

  @Transactional()
  @RabbitSubscribe({
    exchange: RABBITMQ_EXCHANGE_NAME,
    routingKey: RABBITMQ_ROUTING_KEY,
    queue: RABBITMQ_QUEUE_NAME,
    queueOptions: {
      durable: true,
      arguments: { 'x-queue-type': 'quorum' },
      consumerOptions: {
        noAck: false
      }
    }
  })
  async handleOrderPlaced(msg: OrderCreatedJobInterface) {
    console.log('handleOrderPlaced', msg)
    if (await this.inbox.isExisted(msg.id)) {
      return;
    }

    try {
      await this.inbox.create(msg.id)
      await this.emails.sendOrderCreated(msg.data)
    } catch (e) {
      return new Nack(true)
    }

    return
  }
}