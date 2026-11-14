import { describe, expect, it } from 'vitest';
import { HealthIndicatorService } from '@nestjs/terminus';
import { HealthShutdownService } from '../../src/health/health-shutdown.service.js';
import type { EnvironmentService } from '../../src/generic/environment/environment.module.js';

describe('HealthShutdownService', () => {
  const drainMs = 100;
  const environment = { get: () => drainMs } as unknown as EnvironmentService;

  function aService() {
    return new HealthShutdownService(new HealthIndicatorService(), environment);
  }

  it('is up until a drain starts', () => {
    expect(aService().check('shutdown')).toEqual({ shutdown: { status: 'up' } });
  });

  it('turns down as soon as the drain starts and resolves only after DRAIN_MS when the module is destroyed', async () => {
    const service = aService();
    const startedAt = performance.now();

    const drain = service.onModuleDestroy();

    expect(service.check('shutdown')).toEqual({ shutdown: { status: 'down', reason: 'draining' } });

    await drain;

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(drainMs - 1);
    expect(service.check('shutdown')).toEqual({ shutdown: { status: 'down', reason: 'draining' } });
  });
});
