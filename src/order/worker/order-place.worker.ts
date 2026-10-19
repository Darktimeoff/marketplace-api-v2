import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { NativeConnection, Worker } from '@temporalio/worker';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { OrderPlaceActivity } from '../activity/order-place.activity.js';
import { OrderTaskQueueEnum } from '../enum/order-task-queue.enum.js';
import type { OrderPlaceActivitiesInterface } from '../workflow/order-place-workflow.interface.js';

@Injectable()
export class OrderPlaceWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrderPlaceWorker.name);
  private readonly taskQueue = OrderTaskQueueEnum.ORDER_PLACE;
  private readonly workflowsPath = fileURLToPath(new URL(`../workflow/order-place.workflow${extname(import.meta.url)}`, import.meta.url));
  private connection?: NativeConnection;
  private worker?: Worker;
  private running?: Promise<void>;

  constructor(
    private readonly environment: EnvironmentService,
    private readonly activity: OrderPlaceActivity,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.connection = await NativeConnection.connect({ address: this.environment.get('TEMPORAL_ADDRESS') });
    this.worker = await Worker.create({
      connection: this.connection,
      namespace: this.environment.get('TEMPORAL_NAMESPACE'),
      taskQueue: this.taskQueue,
      workflowsPath: this.workflowsPath,
      activities: this.toActivities(),
    });

    this.running = this.worker.run().catch((error) => {
      this.logger.error(`worker for task queue=${this.taskQueue} stopped`, error instanceof Error ? error.stack : String(error));
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker?.getState() === 'RUNNING') {
      this.worker.shutdown();
    }

    await this.running;
    await this.connection?.close();
  }

  private toActivities(): OrderPlaceActivitiesInterface {
    return {
      reserveStock: this.activity.reserveStock.bind(this.activity),
      releaseStock: this.activity.releaseStock.bind(this.activity),
      chargeCustomer: this.activity.chargeCustomer.bind(this.activity),
      refundCustomer: this.activity.refundCustomer.bind(this.activity),
      markPaid: this.activity.markPaid.bind(this.activity),
      markFailed: this.activity.markFailed.bind(this.activity),
    };
  }
}
