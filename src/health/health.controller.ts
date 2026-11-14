import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../generic/auth/decorator/public.decorator.js';
import { HealthShutdownService } from './health-shutdown.service.js';

@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly shutdown: HealthShutdownService,
  ) {}

  @Get('healthz')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('readyz')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.shutdown.check('shutdown'),
      () => this.database.pingCheck('database', { timeout: 500 }),
    ]);
  }
}
