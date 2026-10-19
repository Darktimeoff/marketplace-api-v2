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
  private readonly topicReadyTimeoutMs = 30000;

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
      await this.waitForLeaders(admin, topics.map(({ topic }) => topic));
    } finally {
      await admin.disconnect();
    }
  }

  private async waitForLeaders(admin: KafkaJS.Admin, topics: string[]): Promise<void> {
    const deadline = Date.now() + this.topicReadyTimeoutMs;

    while (true) {
      const metadata = await admin.fetchTopicMetadata({ topics }).catch(() => []);
      const ready = metadata.length === topics.length && metadata.every(({ partitions }) => partitions.length > 0 && partitions.every(({ leader }) => leader >= 0));

      if (ready) {
        return;
      }

      if (Date.now() > deadline) {
        throw new Error(`topics have no leaders after ${this.topicReadyTimeoutMs} ms: ${topics.join(', ')}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
