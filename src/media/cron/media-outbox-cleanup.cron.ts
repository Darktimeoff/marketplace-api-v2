import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaOutboxRepository } from '../repository/media-outbox.repository.js';

@Injectable()
export class MediaOutboxCleanupCron implements OnModuleInit {
  private readonly logger = new Logger(MediaOutboxCleanupCron.name);
  private readonly jobName = 'media-outbox-cleanup';
  private readonly publishedRetentionDays = 7;

  constructor(
    private readonly outbox: MediaOutboxRepository,
    private readonly maintenance: MaintenanceJobRegistryService,
  ) {}

  onModuleInit(): void {
    this.maintenance.register({
      name: this.jobName,
      repeat: { pattern: CronExpression.EVERY_DAY_AT_3AM },
      handle: () => this.deletePublished(),
    });
  }

  async deletePublished(): Promise<void> {
    const deleted = await this.outbox.deletePublishedBefore(subDays(new Date(), this.publishedRetentionDays));
    this.logger.log(`deleted ${deleted} published outbox rows`);
  }
}
