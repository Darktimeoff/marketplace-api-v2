import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { ConfirmChannel, ConsumeMessage } from "amqplib";

@Injectable()
export class RabbitMqReturnListenerService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqReturnListenerService.name)

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      channel.on('return', (msg: ConsumeMessage) => {
        this.logger.error(`unroutable ${msg.fields.exchange}/${msg.fields.routingKey}`);
      });
    });
  }
}
