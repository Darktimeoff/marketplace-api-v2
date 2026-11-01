import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { Transactional } from '@nestjs-cls/transactional';
import { SourceEnum, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { MediaOutboxRepository } from '../repository/media-outbox.repository.js';
import { MediaOutbox } from '../entity/media-outbox.entity.js';

@Injectable()
export class MediaOutboxRelay implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaOutboxRelay.name);
  private readonly batchSize = 100;
  private readonly relayIntervalName = 'media-outbox-relay';
  private readonly defaultExchange = '';
  private relaying = false;

  constructor(
    private readonly outbox: MediaOutboxRepository,
    private readonly amqpConnection: AmqpConnection,
    private readonly environment: EnvironmentService,
    @Optional() private readonly scheduler?: SchedulerRegistry,
  ) {}

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

  @Transactional()
  private async relayBatch(): Promise<void> {
    const rows = await this.outbox.claimUnpublished(this.batchSize);
    const published: MediaOutbox['id'][] = [];

    for (const row of rows) {
      try {
        await this.amqpConnection.publish(this.defaultExchange, row.topic, this.toCloudEvent(row), { messageId: row.id, type: row.type });
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

  private toCloudEvent(row: MediaOutbox): CloudEventInterface<string, object> {
    return {
      specversion: '1.0',
      id: row.id,
      source: SourceEnum.MEDIA,
      type: row.type,
      time: row.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: row.aggregateId,
      correlationid: row.aggregateId,
      data: row.payload,
    };
  }
}
