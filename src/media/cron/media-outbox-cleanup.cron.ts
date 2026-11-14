import { Injectable, OnModuleInit } from '@nestjs/common';
import { Log } from '../../generic/decorator/log.decorator.js';
import { CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaOutboxRepository } from '../repository/media-outbox.repository.js';

@Injectable()
export class MediaOutboxCleanupCron implements OnModuleInit {
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

  @Log(undefined, (deleted: number) => `deleted ${deleted} published outbox rows`)
  async deletePublished(): Promise<number> {
    return this.outbox.deletePublishedBefore(subDays(new Date(), this.publishedRetentionDays));
  }
}
