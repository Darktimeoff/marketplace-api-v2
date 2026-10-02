import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { CLOUD_EVENT_CONTENT_TYPE, TopicEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { KafkaClientService, type KafkaTopicInterface } from './kafka-client.service.js';

const KEEP_FOREVER = [{ name: 'retention.ms', value: '-1' }];

const OWNED_TOPICS: KafkaTopicInterface[] = [
  { topic: TopicEnum.IDENTITY_EVENTS, numPartitions: 3, configEntries: KEEP_FOREVER },
  { topic: TopicEnum.USER_EVENTS, numPartitions: 3, configEntries: KEEP_FOREVER },
];

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: KafkaJS.Producer;

  constructor(private readonly client: KafkaClientService) {
    this.producer = this.client.kafka.producer({ kafkaJS: { idempotent: true, acks: -1 } });
  }

  async onModuleInit(): Promise<void> {
    await this.client.createTopics(OWNED_TOPICS);
    this.logger.log(`topics ready: ${OWNED_TOPICS.map(({ topic }) => topic).join(', ')}`);
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(topic: TopicEnum, message: CloudEventInterface<string, unknown>): Promise<void> {
    await this.send(topic, {
      key: message.subject,
      value: JSON.stringify(message),
      headers: { 'content-type': CLOUD_EVENT_CONTENT_TYPE, ce_type: message.type },
    });
  }

  async send(topic: string, message: KafkaJS.Message): Promise<void> {
    await this.producer.send({ topic, messages: [message] });
  }
}
