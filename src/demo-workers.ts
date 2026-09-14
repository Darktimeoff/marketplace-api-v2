import { DataSource } from 'typeorm';
import { runDemo, checkInvariant } from './demo/context.js';
import { WORKERS_DEDUPE_PREFIX } from './demo/fixtures.js';
import { BackgroundJobService } from './background-job/service/background-job.service.js';
import { WorkerPoolService } from './background-job/worker/worker-pool.service.js';
import { BackgroundJobStatusEnum, BackgroundJobTypeEnum } from './entities/enums.js';
import { sleep } from './generic/util/sleep.util.js';

const JOBS = 24;
const WORKERS = 4;
const WORK_MS = 40;

await runDemo(async (app) => {
  const dataSource = app.get(DataSource);
  const jobs = app.get(BackgroundJobService);
  const pool = app.get(WorkerPoolService);

  const removed = await jobs.deleteByDedupeKeyPrefix(WORKERS_DEDUPE_PREFIX);
  const runId = Date.now();

  await jobs.createMany(
    Array.from({ length: JOBS }, (_, index) => ({
      type: BackgroundJobTypeEnum.ORDER,
      dedupeKey: `${WORKERS_DEDUPE_PREFIX}${runId}:${index + 1}`,
      payload: { index: index + 1 },
      orderId: null,
    })),
  );

  const { queued: totalQueued } = await jobs.countPending(BackgroundJobTypeEnum.ORDER);

  console.log(`Воркер-пул через FOR UPDATE SKIP LOCKED`);
  console.log(`  задач этого прогона: ${JOBS} (удалено с прошлых прогонов: ${removed})`);
  console.log(`  всего в очереди:     ${totalQueued}${totalQueued > JOBS ? ` (+${totalQueued - JOBS} из seed)` : ''}`);
  console.log(`  воркеров:            ${WORKERS}`);
  console.log(`  работа над задачей:  ${WORK_MS} мс`);
  console.log('');

  const result = await pool.run({
    type: BackgroundJobTypeEnum.ORDER,
    size: WORKERS,
    handler: async (job, workerId) => {
      await sleep(WORK_MS);

      return { processedBy: workerId, processedAt: new Date().toISOString() };
    },
  });

  const stats = await dataSource.query<
    { status: string; total: number; processedTwice: number; processedNever: number }[]
  >(
    `SELECT "status",
            count(*)::int AS total,
            count(*) FILTER (WHERE "processedCount" > 1)::int AS "processedTwice",
            count(*) FILTER (WHERE "processedCount" = 0)::int AS "processedNever"
       FROM "BackgroundJob"
      WHERE "dedupeKey" LIKE $1
      GROUP BY "status"`,
    [`${WORKERS_DEDUPE_PREFIX}${runId}:%`],
  );

  const total = stats.reduce((sum, row) => sum + Number(row.total), 0);
  const processedTwice = stats.reduce((sum, row) => sum + Number(row.processedTwice), 0);
  const processedNever = stats.reduce((sum, row) => sum + Number(row.processedNever), 0);
  const ready = stats.find((row) => row.status === BackgroundJobStatusEnum.READY);

  const usedWorkers = Object.entries(result.processedByWorker).filter(([, count]) => count > 0);
  const sequentialMs = totalQueued * WORK_MS;

  console.log('Распределение задач по воркерам:');

  for (const [workerId, count] of Object.entries(result.processedByWorker)) {
    console.log(`  ${workerId}: ${String(count).padStart(3)} ${'█'.repeat(count)}`);
  }

  console.log('');
  console.log(`  обработано всего:     ${result.processed} из ${totalQueued}`);
  console.log(`  обработано дважды:    ${processedTwice}`);
  console.log(`  не обработано:        ${processedNever}`);
  console.log(`  провалов:             ${result.failed}`);
  console.log(`  время пула:           ${result.durationMs} мс`);
  console.log(`  последовательно было бы: ${sequentialMs} мс (${totalQueued} × ${WORK_MS} мс)`);
  console.log(`  ускорение:            ×${(sequentialMs / result.durationMs).toFixed(2)}`);
  console.log('');
  console.log('Инварианты:');

  const checks = [
    checkInvariant('обработано дважды: 0', processedTwice === 0, `${processedTwice}`),
    checkInvariant('необработанных не осталось', processedNever === 0, `${processedNever}`),
    checkInvariant(
      'все задачи этого прогона в статусе READY',
      Number(ready?.total ?? 0) === JOBS && total === JOBS,
      `${ready?.total ?? 0} из ${total}`,
    ),
    checkInvariant(
      'очередь разобрана полностью',
      result.processed === totalQueued,
      `${result.processed} из ${totalQueued}`,
    ),
    checkInvariant(
      'работали >= 2 воркеров',
      usedWorkers.length >= 2,
      `${usedWorkers.length} из ${WORKERS}`,
    ),
    checkInvariant(
      'быстрее последовательной обработки',
      result.durationMs < sequentialMs,
      `${result.durationMs} мс < ${sequentialMs} мс`,
    ),
  ];

  const ok = checks.every(Boolean);

  console.log('');
  console.log(ok ? 'КАЖДАЯ ЗАДАЧА ОБРАБОТАНА РОВНО ОДИН РАЗ' : 'ИНВАРИАНТ НАРУШЕН — см. отметки выше');

  return ok;
});
