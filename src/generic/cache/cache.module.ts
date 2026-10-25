import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RedisModule } from '../redis/redis.module.js';
import { CacheService } from './cache.service.js';
import { CacheExplorer } from './cache.explorer.js';

@Module({
  imports: [RedisModule, DiscoveryModule],
  providers: [CacheService, CacheExplorer],
  exports: [CacheService],
})
export class CacheModule {}
