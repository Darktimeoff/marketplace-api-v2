import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setTimeout as sleep } from 'node:timers/promises';
import { CacheModule } from '../../src/generic/cache/cache.module.js';
import { CacheService } from '../../src/generic/cache/cache.service.js';
import { RedisClientService } from '../../src/generic/redis/redis-client.service.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

describe('CacheService', () => {
  let testModule: TestModule;
  let cache: CacheService;
  let redis: RedisClientService;
  const options = { ttlSeconds: 300, jitterSeconds: 60 };

  beforeAll(async () => {
    testModule = await createTestModule([CacheModule]);
    cache = testModule.app.get(CacheService);
    redis = testModule.app.get(RedisClientService);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  function slowLoad(calls: { count: number }, value: object, delayMs = 200) {
    return async () => {
      calls.count += 1;
      await sleep(delayMs);
      return value;
    };
  }

  it('loads once for concurrent misses and serves every caller the same value', async () => {
    const calls = { count: 0 };

    const values = await Promise.all(Array.from({ length: 20 }, () => cache.getOrLoad('order:1', options, slowLoad(calls, { id: 1 }))));

    expect(calls.count).toBe(1);
    expect(values).toEqual(Array(20).fill({ id: 1 }));
    expect(await redis.cache.exists('lock:order:1')).toBe(0);
  });

  it('serves a warm key from redis without loading', async () => {
    const calls = { count: 0 };
    await cache.getOrLoad('order:2', options, slowLoad(calls, { id: 2 }, 0));

    for (let i = 0; i < 100; i += 1) {
      await cache.getOrLoad('order:2', options, slowLoad(calls, { id: 2 }, 0));
    }

    expect(calls.count).toBe(1);
  });

  it('spreads the ttl of keys warmed together', async () => {
    for (let id = 0; id < 50; id += 1) {
      await cache.getOrLoad(`order:${id}`, options, async () => ({ id }));
    }

    const ttls = await Promise.all(Array.from({ length: 50 }, (_, id) => redis.cache.ttl(`order:${id}`)));

    expect(Math.min(...ttls)).toBeGreaterThanOrEqual(299);
    expect(Math.max(...ttls)).toBeLessThanOrEqual(360);
    expect(new Set(ttls).size).toBeGreaterThan(10);
  });

  it('never releases a lock that another owner took after ours expired', async () => {
    await redis.cache.set('lock:order:3', 'someone-else', 'PX', 5000);

    await (cache as unknown as { releaseLock(key: string, token: string): Promise<void> }).releaseLock('order:3', 'our-token');

    expect(await redis.cache.get('lock:order:3')).toBe('someone-else');
  });

  it('lets a waiter load when the lock owner fails', async () => {
    const calls = { count: 0 };
    const failing = cache.getOrLoad('order:4', options, async () => {
      calls.count += 1;
      await sleep(100);
      throw new Error('database down');
    });
    const waiting = cache.getOrLoad('order:4', options, slowLoad(calls, { id: 4 }, 0));

    await expect(failing).rejects.toThrow('database down');
    expect(await waiting).toEqual({ id: 4 });
    expect(calls.count).toBe(2);
  });
});
