import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { getTlsOptions, type VerifiedTlsOptionsInterface } from '../tls/util/get-tls-options.util.js';

export interface KafkaTopicInterface {
  topic: string;
  numPartitions: number;
  configEntries?: { name: string; value: string }[];
}

@Injectable()
export class KafkaClientService implements OnModuleInit {
  kafka: KafkaJS.Kafka;
  private readonly topicReadyTimeoutMs = 30000;

  constructor(
    private readonly environment: EnvironmentService,
    private readonly secrets: SecretManagerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new KafkaJS.Kafka(
      this.toConfig(
        this.environment.get('KAFKA_BROKERS').split(','),
        getTlsOptions(this.environment.get('TLS_MODE'), this.environment.get('TLS_CA_PATH'), ''),
        await this.sasl(),
      ),
    );
  }

  private async sasl(): Promise<KafkaJS.SASLOptions | undefined> {
    const mechanism = this.environment.get('KAFKA_SASL_MECHANISM');

    if (mechanism === 'none') {
      return undefined;
    }

    return {
      mechanism,
      username: await this.secrets.get('KAFKA_SASL_USERNAME'),
      password: await this.secrets.get('KAFKA_SASL_PASSWORD'),
    };
  }

  private toConfig(brokers: string[], tls: false | VerifiedTlsOptionsInterface, sasl: KafkaJS.SASLOptions | undefined): KafkaJS.CommonConstructorConfig {
    return {
      kafkaJS: {
        clientId: 'marketplace-api',
        brokers,
        logLevel: KafkaJS.logLevel.WARN,
        ssl: Boolean(tls),
        ...(sasl ? { sasl } : {}),
      },
      ...(tls ? { 'ssl.ca.pem': tls.ca.join('\n'), 'ssl.endpoint.identification.algorithm': 'https' as const } : {}),
    };
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
