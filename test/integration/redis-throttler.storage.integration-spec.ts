import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setTimeout as sleep } from 'node:timers/promises';
import { RedisModule } from '../../src/generic/redis/redis.module.js';
import { RedisClientService } from '../../src/generic/redis/redis-client.service.js';
import { RedisThrottlerStorage } from '../../src/generic/rate-limit/redis-throttler.storage.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

describe('RedisThrottlerStorage', () => {
  let first: TestModule;
  let second: TestModule;
  let pods: [RedisThrottlerStorage, RedisThrottlerStorage];

  beforeAll(async () => {
    first = await createTestModule([RedisModule]);
    second = await createTestModule([RedisModule]);
    pods = [new RedisThrottlerStorage(first.app.get(RedisClientService)), new RedisThrottlerStorage(second.app.get(RedisClientService))];
  });

  afterEach(async () => {
    await truncateAllTables(first.dataSource);
  });

  afterAll(async () => {
    await first.close();
    await second.close();
  });

  it('allows up to the limit in the window and blocks the rest until the oldest hit leaves it', async () => {
    const records = [];
    for (let i = 0; i < 7; i += 1) {
      records.push(await pods[0].increment('a', 60_000, 5, 60_000, 'default'));
    }

    expect(records.map(({ isBlocked }) => isBlocked)).toEqual([false, false, false, false, false, true, true]);
    expect(records.map(({ totalHits }) => totalHits)).toEqual([1, 2, 3, 4, 5, 6, 6]);
    expect(records[5].timeToBlockExpire).toBeGreaterThanOrEqual(59);
    expect(records[5].timeToBlockExpire).toBeLessThanOrEqual(60);
  });

  it('shares one limit between two pods', async () => {
    const records = [];
    for (let i = 0; i < 6; i += 1) {
      records.push(await pods[i % 2].increment('b', 60_000, 5, 60_000, 'default'));
    }

    expect(records.filter(({ isBlocked }) => !isBlocked)).toHaveLength(5);
    expect(records[5].isBlocked).toBe(true);
  });

  it('slides: one hit is allowed again once the oldest leaves the window', async () => {
    await pods[0].increment('c', 1000, 2, 1000, 'default');
    await pods[0].increment('c', 1000, 2, 1000, 'default');
    expect((await pods[0].increment('c', 1000, 2, 1000, 'default')).isBlocked).toBe(true);

    await sleep(1100);

    expect((await pods[0].increment('c', 1000, 2, 1000, 'default')).isBlocked).toBe(false);
  });

  it('keeps keys and throttlers apart and expires the counter with the window', async () => {
    await pods[0].increment('d', 60_000, 1, 60_000, 'default');

    expect((await pods[0].increment('e', 60_000, 1, 60_000, 'default')).isBlocked).toBe(false);
    expect((await pods[0].increment('d', 60_000, 1, 60_000, 'other')).isBlocked).toBe(false);
    expect(await first.app.get(RedisClientService).queue.pttl('ratelimit:default:d')).toBeGreaterThan(59_000);
  });
});
