import { Injectable, OnModuleInit } from '@nestjs/common';
import { Log } from '../../generic/logging/decorator/log.decorator.js';
import { CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { OrderWorkflowOutboxRepository } from '../repository/order-workflow-outbox.repository.js';

@Injectable()
export class OrderWorkflowOutboxCleanupCron implements OnModuleInit {
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

  @Log(undefined, deleted => `deleted ${deleted} started workflow outbox rows`)
  async deleteStarted(): Promise<number> {
    return this.outbox.deleteStartedBefore(subDays(new Date(), this.startedRetentionDays));
  }
}
