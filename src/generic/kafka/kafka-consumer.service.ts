import { randomUUID } from 'node:crypto';
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
  private readonly assignmentTimeoutMs = 30000;

  constructor(
    private readonly environment: EnvironmentService,
    private readonly client: KafkaClientService,
    private readonly producer: KafkaProducerService,
  ) {}

  register(subscription: KafkaSubscriptionInterface): void {
    this.subscriptions.push(subscription);
  }

  async onApplicationBootstrap(): Promise<void> {
    const consumersEnabled = this.environment.get('KAFKA_CONSUMERS_ENABLED');

    if (!consumersEnabled) {
      this.logger.warn('KAFKA_CONSUMERS_ENABLED=false, only broadcast consumers are started');
    }

    for (const subscription of this.subscriptions) {
      if (subscription.broadcast || consumersEnabled) {
        await this.start(subscription);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
  }

  private async start({ groupId, topic, broadcast = false, handle }: KafkaSubscriptionInterface): Promise<void> {
    const consumerGroupId = broadcast ? `${groupId}.${randomUUID()}` : groupId;
    const deadLetterTopic = broadcast ? null : `${groupId}.dlt`;

    if (deadLetterTopic) {
      await this.client.createTopics([{ topic: deadLetterTopic, numPartitions: 1, configEntries: [{ name: 'retention.ms', value: '-1' }] }]);
    }

    const consumer = this.client.kafka.consumer({ kafkaJS: { groupId: consumerGroupId, fromBeginning: !broadcast, autoCommit: !broadcast } });
    await consumer.connect();
    await consumer.subscribe({ topic });
    await consumer.run({
      eachMessage: async ({ partition, message }) => {
        const position = `${topic}/${partition}@${message.offset}`;

        try {
          await handle(JSON.parse(message.value?.toString() ?? ''), { partition, offset: message.offset });
        } catch (error) {
          if (error instanceof SyntaxError || error instanceof KafkaRejectedMessageException) {
            this.logger.warn(`${consumerGroupId} rejected ${position}: ${error.message}`);

            if (deadLetterTopic) {
              await this.producer.send(deadLetterTopic, {
                key: message.key,
                value: message.value,
                headers: { ...message.headers, dlt_reason: error.message, dlt_source: position },
              });
            }

            return;
          }

          this.logger.error(`${consumerGroupId} failed ${position}, retrying`, error instanceof Error ? error.stack : String(error));
          throw error;
        }
      },
    });
    this.consumers.push(consumer);

    if (broadcast) {
      await this.waitForAssignment(consumer, consumerGroupId);
    }

    this.logger.log(`${consumerGroupId} consuming ${topic}`);
  }

  private async waitForAssignment(consumer: KafkaJS.Consumer, groupId: string): Promise<void> {
    const deadline = Date.now() + this.assignmentTimeoutMs;

    while (consumer.assignment().length === 0) {
      if (Date.now() > deadline) {
        this.logger.warn(`${groupId} has no partitions after ${this.assignmentTimeoutMs} ms, continuing`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
