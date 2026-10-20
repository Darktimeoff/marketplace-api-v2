import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression, Interval } from '@nestjs/schedule';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { subDays } from 'date-fns';
import { Transactional } from '@nestjs-cls/transactional';
import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { OrderWorkflowOutboxRepository } from '../repository/order-workflow-outbox.repository.js';
import { OrderWorkflowOutbox } from '../entity/order-workflow-outbox.entity.js';
import { TemporalClientService } from '../../generic/temporal/temporal-client.service.js';

@Injectable()
export class OrderWorkflowOutboxRelayService implements OnModuleInit {
  private readonly logger = new Logger(OrderWorkflowOutboxRelayService.name);
  private readonly cleanupJobName = 'order-workflow-outbox-cleanup';
  private readonly batchSize = 100;
  private readonly startedRetentionDays = 7;
  private readonly startTimeoutMs = 10000;
  private relaying = false;

  constructor(
    private readonly outbox: OrderWorkflowOutboxRepository,
    private readonly temporal: TemporalClientService,
    private readonly maintenance: MaintenanceJobRegistryService,
  ) {}

  onModuleInit(): void {
    this.maintenance.register({
      name: this.cleanupJobName,
      repeat: { pattern: CronExpression.EVERY_DAY_AT_3AM },
      handle: () => this.deleteStarted(),
    });
  }

  @Interval(1000)
  async relay(): Promise<void> {
    if (this.relaying) {
      return;
    }

    this.relaying = true;

    try {
      await this.relayBatch();
    } catch (error) {
      this.logger.error('workflow outbox relay failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.relaying = false;
    }
  }

  async deleteStarted(): Promise<void> {
    const deleted = await this.outbox.deleteStartedBefore(subDays(new Date(), this.startedRetentionDays));
    this.logger.log(`deleted ${deleted} started workflow outbox rows`);
  }

  @Transactional()
  private async relayBatch(): Promise<void> {
    const rows = await this.outbox.claimUnstarted(this.batchSize);
    const started: OrderWorkflowOutbox['workflowId'][] = [];

    for (const row of rows) {
      try {
        await this.start(row);
        started.push(row.workflowId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`failed to start ${row.workflowType} workflowId=${row.workflowId}: ${message}`);
        await this.outbox.recordFailure(row.workflowId, message);
        break;
      }
    }

    if (started.length > 0) {
      await this.outbox.markStarted(started);
    }
  }

  private async start(row: OrderWorkflowOutbox): Promise<void> {
    try {
      await this.temporal.client.withDeadline(Date.now() + this.startTimeoutMs, () =>
        this.temporal.client.workflow.start(row.workflowType, {
          taskQueue: row.taskQueue,
          workflowId: row.workflowId,
          workflowIdConflictPolicy: 'USE_EXISTING',
          workflowIdReusePolicy: 'REJECT_DUPLICATE',
          args: [row.input],
        }),
      );
    } catch (error) {
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) {
        throw error;
      }
    }
  }
}
