import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { Transactional } from '@nestjs-cls/transactional';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CLOUD_EVENT_CONTENT_TYPE, SourceEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { OrderOutboxRepository } from '../repository/order-outbox.repository.js';
import { OrderOutbox } from '../entity/order-outbox.entity.js';
import { OrderOutboxBrokerEnum } from '../enum/order-outbox-broker.enum.js';
import { KafkaProducerService } from '../../generic/kafka/kafka-producer.service.js';

@Injectable()
export class OrderOutboxRelayService {
  private readonly logger = new Logger(OrderOutboxRelayService.name);
  private readonly batchSize = 100;
  private readonly publishedRetentionDays = 7;
  private readonly publishOptions = { contentType: CLOUD_EVENT_CONTENT_TYPE, timeout: 10000 };
  private relaying = false;

  constructor(
    private readonly outbox: OrderOutboxRepository,
    private readonly amqpConnection: AmqpConnection,
    private readonly kafka: KafkaProducerService,
  ) {}

  @Interval(1000)
  async relay(): Promise<void> {
    if (this.relaying) {
      return;
    }

    this.relaying = true;

    try {
      await this.relayBatch();
    } catch (error) {
      this.logger.error('outbox relay failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.relaying = false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async deletePublished(): Promise<void> {
    const deleted = await this.outbox.deletePublishedBefore(subDays(new Date(), this.publishedRetentionDays));
    this.logger.log(`deleted ${deleted} published outbox rows`);
  }

  @Transactional()
  private async relayBatch(): Promise<void> {
    const rows = await this.outbox.claimUnpublished(this.batchSize);
    const published: OrderOutbox['id'][] = [];

    for (const row of rows) {
      try {
        await this.send(row);
        published.push(row.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`failed to publish ${row.type} id=${row.id}: ${message}`);
        await this.outbox.recordFailure(row.id, message);
        break;
      }
    }

    if (published.length > 0) {
      await this.outbox.markPublished(published);
    }
  }

  private async send(row: OrderOutbox): Promise<void> {
    if (row.broker === OrderOutboxBrokerEnum.KAFKA) {
      await this.kafka.publish(row.topic, this.toCloudEvent(row));
      return;
    }

    await this.amqpConnection.publish(row.topic, row.type, this.toCloudEvent(row), this.publishOptions);
  }

  private toCloudEvent(row: OrderOutbox): CloudEventInterface<string, object> {
    return {
      specversion: '1.0',
      id: row.id,
      source: SourceEnum.ORDER,
      type: row.type,
      time: row.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: row.aggregateId,
      correlationid: row.aggregateId,
      data: row.payload,
    };
  }
}
