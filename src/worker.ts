import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvironmentService } from './generic/environment/environment.module.js';
import { WorkerPoolService } from './background-job/worker/worker-pool.service.js';
import { BackgroundJobTypeEnum } from './entities/enums.js';

const logger = new Logger('Worker');

const app = await NestFactory.createApplicationContext(AppModule);
const environment = app.get(EnvironmentService);
const pool = app.get(WorkerPoolService);

const stopping = new AbortController();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.log(`${signal}: доработаю текущие задачи и выйду`);
    stopping.abort();
  });
}

const size = environment.get('WORKER_POOL_SIZE');
logger.log(`Воркер-пул на ${size} воркеров, тип задач ${BackgroundJobTypeEnum.ORDER}`);

const result = await pool.run({
  type: BackgroundJobTypeEnum.ORDER,
  size,
  stopWhenDrained: false,
  stopSignal: stopping.signal,
  handler: async (job, workerId) => {
    logger.log(`${workerId}: задача #${job.id} (${job.dedupeKey})`);

    return { processedBy: workerId, processedAt: new Date().toISOString() };
  },
});

logger.log(
  `Остановлен: обработано ${result.processed}, провалов ${result.failed}, ${result.durationMs} мс`,
);

await app.close();
