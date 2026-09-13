import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { BackgroundJobService } from '../../background-job/service/background-job.service.js';
import { OrderSaga } from '../saga/order.saga.js';
import { BackgroundJob } from '../../background-job/entity/background-job.entity.js';
import { BackgroundJobTypeEnum } from '../../entities/enums.js';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { sleep } from '../../generic/util/sleep.util.js';

@Injectable()
export class OrderWorkerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OrderWorkerService.name);
  private running = false;

  constructor(
    private readonly backgroundJobs: BackgroundJobService,
    private readonly orderSaga: OrderSaga,
    private readonly environment: EnvironmentService,
  ) {}

  onApplicationBootstrap(): void {
    this.start(this.environment.get('WORKER_POOL_SIZE'));
  }

  beforeApplicationShutdown(): void {
    this.stop();
  }

  start(poolSize: number, pollIntervalMs = 1000): void {
    this.running = true;

    for (let i = 0; i < poolSize; i++) {
      void this.runLoop(pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
  }

  private async runLoop(pollIntervalMs: number): Promise<void> {
    while (this.running) {
      const processed = await this.processNext();

      if (!processed) {
        await sleep(pollIntervalMs);
      }
    }
  }

  @Transactional()
  async processNext(): Promise<boolean> {
    const job = await this.backgroundJobs.claimNext(BackgroundJobTypeEnum.ORDER);

    if (!job) {
      return false;
    }

    try {
      await this.dispatch(job);
      await this.backgroundJobs.markReady(job.id);
    } catch (error) {
      this.logger.error(`Job ${job.id} (${job.type}) failed`, error);
      await this.backgroundJobs.markFailed(job.id, error instanceof Error ? error.message : String(error));
    }

    return true;
  }

  @Transactional(Propagation.Nested)
  private async dispatch(job: BackgroundJob): Promise<void> {
    if (job.orderId === null) {
      throw new Error(`BackgroundJob ${job.id} of type ORDER has no orderId`);
    }

    await this.orderSaga.handleById(job.orderId);
  }
}
