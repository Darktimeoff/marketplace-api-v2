// TODO(hw-23): remove after homework, npm run demo:queue
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { startDemoApp, report, run } from './demo-harness.js';
import { QueueModule } from '../generic/queue/queue.module.js';
import { MaintenanceQueueService } from '../generic/queue/maintenance-queue.service.js';
import { MaintenanceJobRegistryService } from '../generic/queue/maintenance-job-registry.service.js';
import { RedisClientService } from '../generic/redis/redis-client.service.js';

const FLAKY = 'demo-flaky';
const ONCE = 'demo-once';
const TICK = 'demo-tick';
const NEVER = { pattern: '0 0 1 1 *' };
const calls = { flaky: 0, once: 0, tick: 0 };

@Injectable()
class DemoJobs implements OnModuleInit {
  constructor(private readonly registry: MaintenanceJobRegistryService) {}

  onModuleInit(): void {
    this.registry.register({ name: FLAKY, repeat: NEVER, handle: async () => { calls.flaky += 1; throw new Error('demo: always fails'); } });
    this.registry.register({ name: ONCE, repeat: NEVER, handle: async () => { calls.once += 1; } });
    this.registry.register({ name: TICK, repeat: { every: 1000 }, handle: async () => { calls.tick += 1; } });
  }
}

@Module({ imports: [QueueModule], providers: [DemoJobs] })
class DemoJobsModule {}

await run(async () => {
  const app = await startDemoApp([DemoJobsModule]);
  const maintenance = app.get(MaintenanceQueueService);
  const queue = maintenance.queue;
  const runId = randomUUID();

  try {
    const [, policy] = (await app.get(RedisClientService).queue.config('GET', 'maxmemory-policy')) as [string, string];

    const flakyId = `${FLAKY}-${runId}`;
    await maintenance.enqueue(FLAKY, flakyId);

    const onceId = `${ONCE}-${runId}`;
    await maintenance.enqueue(ONCE, onceId);
    await maintenance.enqueue(ONCE, onceId);
    const queued = (await queue.getJobs(['waiting', 'active', 'delayed', 'completed'])).filter(({ id }) => id === onceId).length;

    await queue.upsertJobScheduler(TICK, { every: 1000 }, { name: TICK });
    const schedulers = (await queue.getJobSchedulers()).filter(({ key }) => key === TICK).length;

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !(await (await queue.getJob(flakyId))?.isFailed())) {
      await sleep(200);
    }
    const ticksBefore = calls.tick;
    await sleep(4_000);
    const scheduledRuns = calls.tick - ticksBefore;
    const flaky = await queue.getJob(flakyId);
    const completed = (await (await queue.getJob(onceId))?.isCompleted()) ? 1 : 0;

    return report(
      {
        'queue-noeviction': policy === 'noeviction' ? 1 : 0,
        attempts: flaky?.attemptsMade ?? 0,
        'handler-runs': calls.flaky,
        completed,
        added: 2,
        queued,
        schedulers,
        'scheduled-runs': scheduledRuns,
      },
      [
        ['the queue redis never evicts', policy === 'noeviction'],
        ['a failing job runs three times', flaky?.attemptsMade === 3 && calls.flaky === 3],
        ['two adds with one jobId keep one job', queued === 1 && calls.once === 1],
        ['one scheduler per id across upserts', schedulers === 1],
        ['the scheduler fires', scheduledRuns >= 3],
      ],
    );
  } finally {
    for (const name of [FLAKY, ONCE, TICK]) {
      await queue.removeJobScheduler(name);
    }
    for (const id of [`${FLAKY}-${runId}`, `${ONCE}-${runId}`]) {
      await (await queue.getJob(id))?.remove();
    }
    for (const job of await queue.getJobs(['completed', 'failed', 'delayed', 'waiting'])) {
      if (job.name === TICK) {
        await job.remove();
      }
    }
    await app.close();
  }
});
