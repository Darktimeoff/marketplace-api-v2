import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit, Optional } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { subDays } from 'date-fns';
import { Transactional } from '@nestjs-cls/transactional';
import { SourceEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { KafkaProducerService } from '../../generic/kafka/kafka-producer.service.js';
import { UserOutboxRepository } from '../repository/user-outbox.repository.js';
import { UserOutbox } from '../entity/user-outbox.entity.js';

@Injectable()
export class UserOutboxRelayService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(UserOutboxRelayService.name);
  private readonly cleanupJobName = 'user-outbox-cleanup';
  private readonly batchSize = 100;
  private readonly publishedRetentionDays = 7;
  private readonly relayIntervalName = 'user-outbox-relay';
  private relaying = false;

  constructor(
    private readonly outbox: UserOutboxRepository,
    private readonly kafka: KafkaProducerService,
    private readonly maintenance: MaintenanceJobRegistryService,
    private readonly environment: EnvironmentService,
    @Optional() private readonly scheduler?: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.maintenance.register({
      name: this.cleanupJobName,
      repeat: { pattern: CronExpression.EVERY_DAY_AT_3AM },
      handle: () => this.deletePublished(),
    });
  }

  onApplicationBootstrap(): void {
    this.scheduler?.addInterval(this.relayIntervalName, setInterval(() => void this.relay(), this.environment.get('OUTBOX_RELAY_INTERVAL_MS')));
  }

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

  async deletePublished(): Promise<void> {
    const deleted = await this.outbox.deletePublishedBefore(subDays(new Date(), this.publishedRetentionDays));
    this.logger.log(`deleted ${deleted} published outbox rows`);
  }

  @Transactional()
  private async relayBatch(): Promise<void> {
    const rows = await this.outbox.claimUnpublished(this.batchSize);
    const published: UserOutbox['id'][] = [];

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

  private toCloudEvent(row: UserOutbox): CloudEventInterface<string, object> {
    return {
      specversion: '1.0',
      id: row.id,
      source: SourceEnum.USER,
      type: row.type,
      time: row.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: row.aggregateId,
      correlationid: row.aggregateId,
      data: row.payload,
    };
  }
}
