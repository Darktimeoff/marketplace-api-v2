import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { SpanKind } from '@opentelemetry/api';
import { EnvironmentService } from '../environment/environment.module.js';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaEventPublisher } from './kafka-event-publisher.js';
import { EventRejectedException } from '../messaging/exception/event-rejected.exception.js';
import type { EventSubscriberInterface, EventSubscriptionInterface } from '../messaging/interface/event-subscriber.interface.js';
import type { KafkaDeliveryInterface } from './interface/kafka-delivery.interface.js';
import { Traced } from '../telemetry/decorator/traced.decorator.js';

@Injectable()
export class KafkaEventSubscriber implements EventSubscriberInterface, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KafkaEventSubscriber.name);
  private readonly subscriptions: EventSubscriptionInterface[] = [];
  private readonly consumers: KafkaJS.Consumer[] = [];
  private readonly assignmentTimeoutMs = 30000;
  private readonly failedOffsets = new Map<string, string>();

  constructor(
    private readonly environment: EnvironmentService,
    private readonly client: KafkaClientService,
    private readonly producer: KafkaEventPublisher,
  ) {}

  register(subscription: EventSubscriptionInterface): void {
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

  private async start({ groupId, topic, broadcast = false, handle }: EventSubscriptionInterface): Promise<void> {
    const consumerGroupId = broadcast ? `${groupId}.${randomUUID()}` : groupId;
    const deadLetterTopic = broadcast ? null : `${groupId}.dlt`;

    if (deadLetterTopic) {
      await this.client.createTopics([{ topic: deadLetterTopic, numPartitions: 1, configEntries: [{ name: 'retention.ms', value: '-1' }] }]);
    }

    const consumer = this.client.kafka.consumer({ kafkaJS: { groupId: consumerGroupId, fromBeginning: !broadcast, autoCommit: !broadcast } });
    await consumer.connect();
    await consumer.subscribe({ topic });
    await consumer.run({
      eachMessage: ({ partition, message }) =>
        this.process({
          groupId: consumerGroupId,
          topic,
          partition,
          message,
          handle,
          deadLetterTopic,
          traceparent: message.headers?.traceparent?.toString(),
          redelivered: this.failedOffsets.get(`${consumerGroupId}/${topic}/${partition}`) === message.offset,
        }),
    });
    this.consumers.push(consumer);

    if (broadcast) {
      await this.waitForAssignment(consumer, consumerGroupId);
    }

    this.logger.log(`${consumerGroupId} consuming ${topic}`);
  }

  @Traced({
    name: delivery => `process ${delivery.topic}`,
    kind: SpanKind.CONSUMER,
    parent: delivery => (delivery.redelivered ? undefined : delivery.traceparent),
    link: delivery => (delivery.redelivered ? delivery.traceparent : undefined),
    attributes: delivery => ({
      'messaging.system': 'kafka',
      'messaging.destination.name': delivery.topic,
      'messaging.consumer.group.name': delivery.groupId,
      'messaging.destination.partition.id': String(delivery.partition),
      'messaging.kafka.offset': Number(delivery.message.offset),
      'messaging.message.redelivered': delivery.redelivered,
    }),
  })
  private async process({ groupId, topic, partition, message, handle, deadLetterTopic }: KafkaDeliveryInterface): Promise<void> {
    const position = `${topic}/${partition}@${message.offset}`;
    const attemptKey = `${groupId}/${topic}/${partition}`;

    try {
      await handle(JSON.parse(message.value?.toString() ?? ''), { partition, offset: message.offset });
      this.failedOffsets.delete(attemptKey);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof EventRejectedException) {
        this.failedOffsets.delete(attemptKey);
        this.logger.warn(`${groupId} rejected ${position}: ${error.message}`);

        if (deadLetterTopic) {
          await this.producer.send(deadLetterTopic, {
            key: message.key,
            value: message.value,
            headers: { ...message.headers, dlt_reason: error.message, dlt_source: position },
          });
        }

        return;
      }

      this.failedOffsets.set(attemptKey, message.offset);
      this.logger.error(`${groupId} failed ${position}, retrying`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
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
