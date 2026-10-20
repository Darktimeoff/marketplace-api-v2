import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MAINTENANCE_QUEUE } from './maintenance-queue.constant.js';
import type { MaintenanceJobInterface } from './maintenance-job.interface.js';

@Injectable()
export class MaintenanceQueueService implements OnApplicationBootstrap {
  private readonly jobs = new Map<string, MaintenanceJobInterface>();

  constructor(@InjectQueue(MAINTENANCE_QUEUE) readonly queue: Queue) {}

  register(job: MaintenanceJobInterface): void {
    this.jobs.set(job.name, job);
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const job of this.jobs.values()) {
      await this.queue.upsertJobScheduler(job.name, job.repeat, { name: job.name });
    }
  }

  async enqueue(name: string, jobId: string): Promise<void> {
    await this.queue.add(name, {}, { jobId });
  }

  async handle(name: string): Promise<void> {
    const job = this.jobs.get(name);

    if (!job) {
      throw new Error(`no handler registered for job ${name}`);
    }

    await job.handle();
  }
}
