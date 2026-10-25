import { Injectable } from '@nestjs/common';
import type { MaintenanceJobInterface } from './maintenance-job.interface.js';

@Injectable()
export class MaintenanceJobRegistryService {
  private readonly jobs = new Map<string, MaintenanceJobInterface>();

  register(job: MaintenanceJobInterface): void {
    this.jobs.set(job.name, job);
  }

  get(name: string): MaintenanceJobInterface | null {
    return this.jobs.get(name) ?? null;
  }

  all(): MaintenanceJobInterface[] {
    return [...this.jobs.values()];
  }
}
