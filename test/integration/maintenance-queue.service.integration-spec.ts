import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { QueueModule } from '../../src/generic/queue/queue.module.js';
import { MaintenanceQueueService } from '../../src/generic/queue/maintenance-queue.service.js';
import { MaintenanceJobRegistryService } from '../../src/generic/queue/maintenance-job-registry.service.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

const calls = { flaky: 0, once: 0, tick: 0 };

@Injectable()
class TestJobs implements OnModuleInit {
  constructor(private readonly registry: MaintenanceJobRegistryService) {}

  onModuleInit(): void {
    this.registry.register({ name: 'tick', repeat: { every: 300 }, handle: async () => { calls.tick += 1; } });
    this.registry.register({ name: 'flaky', repeat: { pattern: '0 0 1 1 *' }, handle: async () => { calls.flaky += 1; throw new Error('always fails'); } });
    this.registry.register({ name: 'once', repeat: { pattern: '0 0 1 1 *' }, handle: async () => { calls.once += 1; } });
  }
}

@Module({ imports: [QueueModule], providers: [TestJobs] })
class TestJobsModule {}

describe('MaintenanceQueueService', () => {
  let testModule: TestModule;
  let maintenance: MaintenanceQueueService;

  beforeAll(async () => {
    testModule = await createTestModule([TestJobsModule]);
    maintenance = testModule.app.get(MaintenanceQueueService);
  });

  afterAll(async () => {
    await testModule.close();
    await truncateAllTables(testModule.dataSource).catch(() => undefined);
  });

  it('retries a failing job three times with backoff, then marks it failed', async () => {
    await maintenance.enqueue('flaky', 'flaky-1');

    await vi.waitFor(async () => {
      expect(await (await maintenance.queue.getJob('flaky-1'))?.isFailed()).toBe(true);
    }, { timeout: 15_000, interval: 100 });

    expect(calls.flaky).toBe(3);
    expect((await maintenance.queue.getJob('flaky-1'))?.attemptsMade).toBe(3);
  });

  it('keeps one job for two adds with the same jobId', async () => {
    await maintenance.enqueue('once', 'once-2026-10-19');
    await maintenance.enqueue('once', 'once-2026-10-19');

    await vi.waitFor(async () => {
      expect(await (await maintenance.queue.getJob('once-2026-10-19'))?.isCompleted()).toBe(true);
    }, { timeout: 5_000, interval: 100 });
    await maintenance.enqueue('once', 'once-2026-10-19');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(calls.once).toBe(1);
  });

  it('fails a job without a handler at once instead of retrying it', async () => {
    await maintenance.enqueue('unknown', 'unknown-1');

    await vi.waitFor(async () => {
      expect(await (await maintenance.queue.getJob('unknown-1'))?.isFailed()).toBe(true);
    }, { timeout: 5_000, interval: 100 });

    expect((await maintenance.queue.getJob('unknown-1'))?.attemptsMade).toBe(1);
  });

  it('runs a scheduler on its interval and keeps one scheduler per id across upserts', async () => {
    await maintenance.queue.upsertJobScheduler('tick', { every: 300 }, { name: 'tick' });

    await vi.waitFor(() => {
      expect(calls.tick).toBeGreaterThanOrEqual(3);
    }, { timeout: 5_000, interval: 100 });

    const [ticked] = (await maintenance.queue.getJobs(['completed'])).filter(({ name }) => name === 'tick');
    expect(ticked.opts).toMatchObject({ attempts: 3, backoff: { type: 'exponential', delay: 1000, jitter: 0.5 } });

    const schedulers = await maintenance.queue.getJobSchedulers();
    expect(schedulers.map(({ key }) => key).toSorted()).toEqual(['flaky', 'once', 'tick']);
  });
});
