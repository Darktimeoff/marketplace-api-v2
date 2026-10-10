import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { EnvironmentService } from '../environment/environment.module.js';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { KafkaRejectedMessageException } from './exception/kafka-rejected-message.exception.js';
import type { KafkaSubscriptionInterface } from './interface/kafka-subscription.interface.js';

@Injectable()
export class KafkaConsumerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly subscriptions: KafkaSubscriptionInterface[] = [];
  private readonly consumers: KafkaJS.Consumer[] = [];

  constructor(
    private readonly environment: EnvironmentService,
    private readonly client: KafkaClientService,
    private readonly producer: KafkaProducerService,
  ) {}

  register(subscription: KafkaSubscriptionInterface): void {
    this.subscriptions.push(subscription);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.environment.get('KAFKA_CONSUMERS_ENABLED')) {
      this.logger.warn('KAFKA_CONSUMERS_ENABLED=false, consumers are not started');
      return;
    }

    for (const subscription of this.subscriptions) {
      await this.start(subscription);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
  }

  private async start({ groupId, topic, handle }: KafkaSubscriptionInterface): Promise<void> {
    const deadLetterTopic = `${groupId}.dlt`;
    await this.client.createTopics([{ topic: deadLetterTopic, numPartitions: 1, configEntries: [{ name: 'retention.ms', value: '-1' }] }]);

    const consumer = this.client.kafka.consumer({ kafkaJS: { groupId, fromBeginning: true } });
    await consumer.connect();
    await consumer.subscribe({ topic });
    await consumer.run({
      eachMessage: async ({ partition, message }) => {
        const position = `${topic}/${partition}@${message.offset}`;

        try {
          await handle(JSON.parse(message.value?.toString() ?? ''));
        } catch (error) {
          if (error instanceof SyntaxError || error instanceof KafkaRejectedMessageException) {
            this.logger.warn(`${groupId} rejected ${position}: ${error.message}`);
            await this.producer.send(deadLetterTopic, {
              key: message.key,
              value: message.value,
              headers: { ...message.headers, dlt_reason: error.message, dlt_source: position },
            });
            return;
          }

          this.logger.error(`${groupId} failed ${position}, retrying`, error instanceof Error ? error.stack : String(error));
          throw error;
        }
      },
    });
    this.consumers.push(consumer);
    this.logger.log(`${groupId} consuming ${topic}`);
  }
}
