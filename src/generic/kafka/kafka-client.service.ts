import { Injectable } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { EnvironmentService } from '../environment/environment.module.js';

export interface KafkaTopicInterface {
  topic: string;
  numPartitions: number;
  configEntries?: { name: string; value: string }[];
}

@Injectable()
export class KafkaClientService {
  readonly kafka: KafkaJS.Kafka;

  constructor(environment: EnvironmentService) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: 'marketplace-api',
        brokers: environment.get('KAFKA_BROKERS').split(','),
        logLevel: KafkaJS.logLevel.WARN,
      },
    });
  }

  async createTopics(topics: KafkaTopicInterface[]): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();

    try {
      await admin.createTopics({ topics: topics.map((topic) => ({ ...topic, replicationFactor: -1 })) });
    } finally {
      await admin.disconnect();
    }
  }
}
