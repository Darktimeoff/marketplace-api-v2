import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { CacheService } from './cache.service.js';

@Module({
  imports: [RedisModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
