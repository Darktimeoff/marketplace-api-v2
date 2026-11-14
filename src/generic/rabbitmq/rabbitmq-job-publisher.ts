import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { CloudEventInterface } from '@marketplace/messaging-contracts';
import type { JobPublisherInterface } from '../messaging/interface/job-publisher.interface.js';

@Injectable()
export class RabbitMqJobPublisher implements JobPublisherInterface {
  private readonly defaultExchange = '';

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publish(queue: string, message: CloudEventInterface<string, unknown>): Promise<void> {
    await this.amqpConnection.publish(this.defaultExchange, queue, message, { messageId: message.id, type: message.type });
  }
}
