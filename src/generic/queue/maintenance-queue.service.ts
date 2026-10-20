import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MAINTENANCE_QUEUE } from './maintenance-queue.constant.js';
import { MaintenanceJobRegistryService } from './maintenance-job-registry.service.js';

@Injectable()
export class MaintenanceQueueService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) readonly queue: Queue,
    private readonly registry: MaintenanceJobRegistryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const job of this.registry.all()) {
      await this.queue.upsertJobScheduler(job.name, job.repeat, { name: job.name });
    }
  }

  async enqueue(name: string, jobId: string): Promise<void> {
    await this.queue.add(name, {}, { jobId });
  }
}
