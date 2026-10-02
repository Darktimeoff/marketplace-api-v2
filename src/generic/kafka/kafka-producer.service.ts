import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { CLOUD_EVENT_CONTENT_TYPE, TopicEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { EnvironmentService } from '../environment/environment.module.js';

const OWNED_TOPICS = [
  { topic: TopicEnum.IDENTITY_EVENTS, numPartitions: 3, configEntries: [{ name: 'retention.ms', value: '-1' }] },
];

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly kafka: KafkaJS.Kafka;
  private readonly producer: KafkaJS.Producer;

  constructor(environment: EnvironmentService) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: 'marketplace-api',
        brokers: environment.get('KAFKA_BROKERS').split(','),
        logLevel: KafkaJS.logLevel.WARN,
      },
    });
    this.producer = this.kafka.producer({ kafkaJS: { idempotent: true, acks: -1 } });
  }

  async onModuleInit(): Promise<void> {
    await this.createOwnedTopics();
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(topic: TopicEnum, message: CloudEventInterface<string, unknown>): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key: message.subject, value: JSON.stringify(message), headers: { 'content-type': CLOUD_EVENT_CONTENT_TYPE, ce_type: message.type } }],
    });
  }

  private async createOwnedTopics(): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();

    try {
      await admin.createTopics({ topics: OWNED_TOPICS.map((topic) => ({ ...topic, replicationFactor: -1 })) });
      this.logger.log(`topics ready: ${OWNED_TOPICS.map(({ topic }) => topic).join(', ')}`);
    } finally {
      await admin.disconnect();
    }
  }
}
