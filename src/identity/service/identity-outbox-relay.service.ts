import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { Transactional } from '@nestjs-cls/transactional';
import { SourceEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { KafkaProducerService } from '../../generic/kafka/kafka-producer.service.js';
import { IdentityOutboxRepository } from '../repository/identity-outbox.repository.js';
import { IdentityOutbox } from '../entity/identity-outbox.entity.js';

@Injectable()
export class IdentityOutboxRelayService {
  private readonly logger = new Logger(IdentityOutboxRelayService.name);
  private readonly batchSize = 100;
  private readonly publishedRetentionDays = 7;
  private relaying = false;

  constructor(
    private readonly outbox: IdentityOutboxRepository,
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
    const published: IdentityOutbox['id'][] = [];

    for (const row of rows) {
      try {
        await this.kafka.publish(row.topic, this.toCloudEvent(row));
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

  private toCloudEvent(row: IdentityOutbox): CloudEventInterface<string, object> {
    return {
      specversion: '1.0',
      id: row.id,
      source: SourceEnum.IDENTITY,
      type: row.type,
      time: row.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: row.aggregateId,
      correlationid: row.aggregateId,
      data: row.payload,
    };
  }
}
