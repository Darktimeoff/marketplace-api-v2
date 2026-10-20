import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';
import { randomUUID } from 'node:crypto';
import type { RedisClientService } from '../redis/redis-client.service.js';

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly slidingWindowScript = `
    local time = redis.call('TIME')
    local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
    local window = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
    local allowed = 0
    if redis.call('ZCARD', KEYS[1]) < limit then
      redis.call('ZADD', KEYS[1], now, ARGV[3])
      redis.call('PEXPIRE', KEYS[1], window)
      allowed = 1
    end
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    return {allowed, redis.call('ZCARD', KEYS[1]), tonumber(oldest[2]) + window - now}
  `;

  constructor(private readonly redis: RedisClientService) {}

  async increment(key: string, ttl: number, limit: number, _blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const [allowed, totalHits, windowLeftMs] = (await this.redis.queue.eval(this.slidingWindowScript, 1, `ratelimit:${throttlerName}:${key}`, ttl, limit, randomUUID())) as [number, number, number];
    const windowLeftSeconds = Math.max(1, Math.ceil(windowLeftMs / 1000));

    return {
      totalHits: allowed === 1 ? totalHits : totalHits + 1,
      timeToExpire: windowLeftSeconds,
      isBlocked: allowed === 0,
      timeToBlockExpire: allowed === 0 ? windowLeftSeconds : 0,
    };
  }
}
