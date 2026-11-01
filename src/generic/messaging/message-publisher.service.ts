import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { CloudEventInterface, TopicEnum } from '@marketplace/messaging-contracts';
import { KafkaProducerService } from '../kafka/kafka-producer.service.js';
import { MessageBrokerEnum } from './enum/message-broker.enum.js';

@Injectable()
export class MessagePublisherService {
  private readonly defaultExchange = '';

  constructor(
    private readonly kafka: KafkaProducerService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async publish(broker: MessageBrokerEnum, topic: string, message: CloudEventInterface<string, unknown>): Promise<void> {
    if (broker === MessageBrokerEnum.RABBITMQ) {
      await this.amqpConnection.publish(this.defaultExchange, topic, message, { messageId: message.id, type: message.type });
      return;
    }

    await this.kafka.publish(topic as TopicEnum, message);
  }
}
