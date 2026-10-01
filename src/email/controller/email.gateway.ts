import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { RABBITMQ_EXCHANGE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_exchange_name.constant.js";
import { RABBITMQ_ROUTING_KEY } from "../../generic/rabbitmq/constant/rabbitmq_routing_key.constant.js";
import { RABBITMQ_QUEUE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_queue_name.constant.js";

@Injectable()
export class EmailGateway {
  @RabbitSubscribe({
    exchange: RABBITMQ_EXCHANGE_NAME,
    routingKey: RABBITMQ_ROUTING_KEY,
    queue: RABBITMQ_QUEUE_NAME,
    queueOptions: {
      durable: true,
    },
  })
  async handleOrderPlaced(msg: object) {
    console.log(msg)
  }
}