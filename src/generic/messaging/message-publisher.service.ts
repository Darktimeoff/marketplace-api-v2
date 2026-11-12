import { Inject, Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { CloudEventInterface, TopicEnum } from '@marketplace/messaging-contracts';
import { EVENT_PUBLISHER } from './constant/messaging.constant.js';
import type { EventPublisherInterface } from './interface/event-publisher.interface.js';
import { MessageBrokerEnum } from './enum/message-broker.enum.js';

@Injectable()
export class MessagePublisherService {
  private readonly defaultExchange = '';

  constructor(
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async publish(broker: MessageBrokerEnum, topic: string, message: CloudEventInterface<string, unknown>): Promise<void> {
    if (broker === MessageBrokerEnum.RABBITMQ) {
      await this.amqpConnection.publish(this.defaultExchange, topic, message, { messageId: message.id, type: message.type });
      return;
    }

    await this.events.publish(topic as TopicEnum, message);
  }
}
