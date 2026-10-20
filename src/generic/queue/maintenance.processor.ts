import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError, type Job } from 'bullmq';
import { MaintenanceJobRegistryService } from './maintenance-job-registry.service.js';
import { MAINTENANCE_QUEUE } from './maintenance-queue.constant.js';

@Processor(MAINTENANCE_QUEUE, { concurrency: 1, autorun: false })
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly registry: MaintenanceJobRegistryService) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.run().catch((error: Error) => this.logger.error(`maintenance worker stopped: ${error.message}`, error.stack));
  }

  async process(job: Job): Promise<void> {
    const registered = this.registry.get(job.name);

    if (!registered) {
      throw new UnrecoverableError(`no handler registered for job ${job.name}`);
    }

    await registered.handle();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.warn(`job ${job?.name} id=${job?.id} attempt ${job?.attemptsMade}/${job?.opts.attempts} failed: ${error.message}`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`job id=${jobId} stalled`);
  }
}
