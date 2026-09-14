import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { BackgroundJobService } from '../service/background-job.service.js';
import { BackgroundJob } from '../entity/background-job.entity.js';
import { BackgroundJobTypeEnum } from '../../entities/enums.js';
import { sleep } from '../../generic/util/sleep.util.js';
import type { TransactionalAdapterTypeOrmWithRetry } from '../../generic/db/typeorm-retry.adapter.js';

export type BackgroundJobHandler = (
  job: BackgroundJob,
  workerId: string,
) => Promise<Record<string, unknown>>;

export interface WorkerPoolOptionsInterface {
  type: BackgroundJobTypeEnum;
  size: number;
  handler: BackgroundJobHandler;
  idlePollMs?: number;
  maxIdlePolls?: number;
  stopWhenDrained?: boolean;
  stopSignal?: AbortSignal;
}

export interface WorkerPoolResultInterface {
  processedByWorker: Record<string, number>;
  processed: number;
  failed: number;
  durationMs: number;
}

@Injectable()
export class WorkerPoolService {
  private readonly logger = new Logger(WorkerPoolService.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrmWithRetry>,
    private readonly jobs: BackgroundJobService,
  ) {}

  async run(options: WorkerPoolOptionsInterface): Promise<WorkerPoolResultInterface> {
    const processedByWorker: Record<string, number> = {};
    const startedAt = Date.now();

    const workerIds = Array.from({ length: options.size }, (_, index) => `worker-${index + 1}`);

    for (const workerId of workerIds) {
      processedByWorker[workerId] = 0;
    }

    const failures = await Promise.all(
      workerIds.map((workerId) => this.runWorker(workerId, options, processedByWorker)),
    );

    return {
      processedByWorker,
      processed: Object.values(processedByWorker).reduce((sum, count) => sum + count, 0),
      failed: failures.reduce((sum, count) => sum + count, 0),
      durationMs: Date.now() - startedAt,
    };
  }

  private async runWorker(
    workerId: string,
    options: WorkerPoolOptionsInterface,
    processedByWorker: Record<string, number>,
  ): Promise<number> {
    const { idlePollMs = 25, maxIdlePolls = 200, stopWhenDrained = true, stopSignal } = options;
    let idlePolls = 0;
    let failed = 0;

    for (;;) {
      if (stopSignal?.aborted) {
        return failed;
      }

      const outcome = await this.processOne(workerId, options);

      if (outcome === 'processed' || outcome === 'failed') {
        idlePolls = 0;

        if (outcome === 'processed') {
          processedByWorker[workerId] += 1;
        } else {
          failed += 1;
        }

        continue;
      }

      const { queued, processing } = await this.jobs.countPending(options.type);

      if (queued === 0 && processing === 0) {
        if (stopWhenDrained) {
          return failed;
        }

        await sleep(idlePollMs);
        continue;
      }

      if (++idlePolls > maxIdlePolls) {
        this.logger.warn(
          `${workerId}: ${maxIdlePolls} пустых опросов подряд при непустой очереди (queued=${queued}, processing=${processing}), выхожу`,
        );

        return failed;
      }

      await sleep(idlePollMs);
    }
  }

  private async processOne(
    workerId: string,
    { type, handler }: WorkerPoolOptionsInterface,
  ): Promise<'processed' | 'failed' | 'empty'> {
    let claimedId: BackgroundJob['id'] | null = null;

    try {
      return await this.txHost.withTransaction(async () => {
        const job = await this.jobs.claimNext(type, workerId);

        if (!job) {
          return 'empty' as const;
        }

        claimedId = job.id;
        const result = await handler(job, workerId);
        await this.jobs.markReady(job.id, workerId, result);

        return 'processed' as const;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (claimedId === null) {
        throw error;
      }

      this.logger.warn(`${workerId}: задача ${claimedId} упала — ${message}`);
      await this.txHost.withTransaction(() => this.jobs.markFailed(claimedId!, message));

      return 'failed';
    }
  }
}
