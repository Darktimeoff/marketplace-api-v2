import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MaintenanceQueueService } from './maintenance-queue.service.js';
import { MAINTENANCE_QUEUE } from './maintenance-queue.constant.js';

@Processor(MAINTENANCE_QUEUE, { concurrency: 1, autorun: false })
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly maintenance: MaintenanceQueueService) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.run().catch((error: Error) => this.logger.error(`maintenance worker stopped: ${error.message}`, error.stack));
  }

  process(job: Job): Promise<void> {
    return this.maintenance.handle(job.name);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.warn(`job ${job?.name} id=${job?.id} attempt ${job?.attemptsMade}/${job?.opts.attempts} failed: ${error.message}`);
  }
}
