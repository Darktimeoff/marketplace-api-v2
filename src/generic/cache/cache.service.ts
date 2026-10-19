import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { RedisClientService } from '../redis/redis-client.service.js';
import type { CacheEntryOptionsInterface } from './cache-entry-options.interface.js';

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisClientService) {}

  async getOrLoad<T>(key: string, options: CacheEntryOptionsInterface, load: () => Promise<T>): Promise<T> {
    const cached = await this.redis.cache.get(key);

    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    const value = await load();
    await this.redis.cache.set(key, JSON.stringify(value), 'EX', this.toTtlSeconds(options));
    return value;
  }

  async delete(key: string): Promise<void> {
    await this.redis.cache.del(key);
  }

  private toTtlSeconds({ ttlSeconds, jitterSeconds }: CacheEntryOptionsInterface): number {
    return ttlSeconds + randomInt(0, jitterSeconds + 1);
  }
}
