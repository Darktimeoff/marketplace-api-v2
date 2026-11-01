import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { OrderWorkflowOutboxRepository } from '../repository/order-workflow-outbox.repository.js';

@Injectable()
export class OrderWorkflowOutboxCleanupCron implements OnModuleInit {
  private readonly logger = new Logger(OrderWorkflowOutboxCleanupCron.name);
  private readonly jobName = 'order-workflow-outbox-cleanup';
  private readonly startedRetentionDays = 7;

  constructor(
    private readonly outbox: OrderWorkflowOutboxRepository,
    private readonly maintenance: MaintenanceJobRegistryService,
  ) {}

  onModuleInit(): void {
    this.maintenance.register({
      name: this.jobName,
      repeat: { pattern: CronExpression.EVERY_DAY_AT_3AM },
      handle: () => this.deleteStarted(),
    });
  }

  async deleteStarted(): Promise<void> {
    const deleted = await this.outbox.deleteStartedBefore(subDays(new Date(), this.startedRetentionDays));
    this.logger.log(`deleted ${deleted} started workflow outbox rows`);
  }
}
