import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '../redis/redis.module.js';
import { RedisClientService } from '../redis/redis-client.service.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisClientService],
      useFactory: (redis: RedisClientService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
