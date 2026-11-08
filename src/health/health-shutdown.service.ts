import { setTimeout } from 'node:timers/promises';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { EnvironmentService } from '../generic/environment/environment.module.js';

@Injectable()
export class HealthShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthShutdownService.name);
  private draining = false;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly environment: EnvironmentService,
  ) {}

  check(key: string): HealthIndicatorResult {
    const indicator = this.healthIndicatorService.check(key);

    return this.draining ? indicator.down({ reason: 'draining' }) : indicator.up();
  }

  async onModuleDestroy(): Promise<void> {
    const drainMs = this.environment.get('DRAIN_MS');

    this.draining = true;
    this.logger.log(`Not ready, draining for ${drainMs} ms before close`);
    await setTimeout(drainMs);
  }
}
