import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { RedisClientService } from '../redis/redis-client.service.js';
import type { CacheEntryOptionsInterface } from './cache-entry-options.interface.js';

@Injectable()
export class CacheService {
  private readonly lockTtlMs = 5000;
  private readonly waitTimeoutMs = 5000;
  private readonly pollIntervalMs = 50;

  constructor(private readonly redis: RedisClientService) {}

  async getOrLoad<T>(key: string, options: CacheEntryOptionsInterface, load: () => Promise<T>): Promise<T> {
    const cached = await this.read<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const deadline = Date.now() + this.waitTimeoutMs;

    while (Date.now() < deadline) {
      const token = randomUUID();

      if (await this.acquireLock(key, token)) {
        try {
          return await this.loadAndStore(key, options, load);
        } finally {
          await this.releaseLock(key, token);
        }
      }

      await sleep(this.pollIntervalMs);
      const loaded = await this.read<T>(key);

      if (loaded !== undefined) {
        return loaded;
      }
    }

    return this.loadAndStore(key, options, load);
  }

  async delete(key: string): Promise<void> {
    await this.redis.cache.del(key);
  }

  private async read<T>(key: string): Promise<T | undefined> {
    const cached = await this.redis.cache.get(key);
    return cached === null ? undefined : (JSON.parse(cached) as T);
  }

  private async loadAndStore<T>(key: string, options: CacheEntryOptionsInterface, load: () => Promise<T>): Promise<T> {
    const value = await load();
    await this.redis.cache.set(key, JSON.stringify(value), 'EX', this.toTtlSeconds(options));
    return value;
  }

  private async acquireLock(key: string, token: string): Promise<boolean> {
    return (await this.redis.cache.set(this.toLockKey(key), token, 'PX', this.lockTtlMs, 'NX')) === 'OK';
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    await this.redis.cache.call('DELEX', this.toLockKey(key), 'IFEQ', token);
  }

  private toLockKey(key: string): string {
    return `lock:${key}`;
  }

  private toTtlSeconds({ ttlSeconds, jitterSeconds }: CacheEntryOptionsInterface): number {
    return ttlSeconds + randomInt(0, jitterSeconds + 1);
  }
}
