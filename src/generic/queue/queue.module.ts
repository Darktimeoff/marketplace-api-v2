import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '../redis/redis.module.js';
import { RedisClientService } from '../redis/redis-client.service.js';
import { MaintenanceQueueService } from './maintenance-queue.service.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { MAINTENANCE_QUEUE } from './maintenance-queue.constant.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisClientService],
      useFactory: async (redis: RedisClientService) => ({
        connection: await redis.createBullConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000, jitter: 0.5 },
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
          removeOnFail: { age: 30 * 24 * 60 * 60 },
        },
      }),
    }),
    BullModule.registerQueue({ name: MAINTENANCE_QUEUE }),
  ],
  providers: [MaintenanceQueueService, MaintenanceProcessor],
  exports: [MaintenanceQueueService],
})
export class QueueModule {}
