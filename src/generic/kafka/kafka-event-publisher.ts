import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { CLOUD_EVENT_CONTENT_TYPE, TopicEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { KafkaClientService, type KafkaTopicInterface } from './kafka-client.service.js';
import type { EventPublisherInterface } from '../messaging/interface/event-publisher.interface.js';

@Injectable()
export class KafkaEventPublisher implements EventPublisherInterface, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaEventPublisher.name);
  private readonly keepForever = [{ name: 'retention.ms', value: '-1' }];
  private readonly ownedTopics: KafkaTopicInterface[] = [
    { topic: TopicEnum.IDENTITY_EVENTS, numPartitions: 3, configEntries: this.keepForever },
    { topic: TopicEnum.USER_EVENTS, numPartitions: 3, configEntries: this.keepForever },
    { topic: TopicEnum.ORDER_EVENTS, numPartitions: 3, configEntries: this.keepForever },
    { topic: TopicEnum.PRODUCT_EVENTS, numPartitions: 3, configEntries: this.keepForever },
    { topic: TopicEnum.MEDIA_EVENTS, numPartitions: 3, configEntries: this.keepForever },
  ];
  private producer: KafkaJS.Producer;

  constructor(private readonly client: KafkaClientService) {}

  async onModuleInit(): Promise<void> {
    this.producer = this.client.kafka.producer({ kafkaJS: { idempotent: true, acks: -1 }, 'message.timeout.ms': 10000 });
    await this.client.createTopics(this.ownedTopics);
    this.logger.log(`topics ready: ${this.ownedTopics.map(({ topic }) => topic).join(', ')}`);
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(topic: TopicEnum, event: CloudEventInterface<string, unknown>): Promise<void> {
    await this.send(topic, {
      key: event.subject,
      value: JSON.stringify(event),
      headers: { 'content-type': CLOUD_EVENT_CONTENT_TYPE, ce_type: event.type },
    });
  }

  async send(topic: string, message: KafkaJS.Message): Promise<void> {
    await this.producer.send({ topic, messages: [message] });
  }
}
