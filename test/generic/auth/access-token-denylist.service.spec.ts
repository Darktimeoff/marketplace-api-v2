import { describe, expect, it, vi } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessTokenDenylistService } from '../../../src/generic/auth/access-token-denylist.service.js';
import type { RedisClientService } from '../../../src/generic/redis/redis-client.service.js';
import type { EnvironmentService } from '../../../src/generic/environment/environment.module.js';

function aDenylist(queue: Partial<{ status: string; exists: () => Promise<number>; set: () => Promise<unknown> }>, failOpen = true) {
  const redis = { queue: { status: 'ready', exists: async () => 0, set: async () => 'OK', ...queue } } as unknown as RedisClientService;
  const environment = { get: () => failOpen } as unknown as EnvironmentService;
  return new AccessTokenDenylistService(redis, environment);
}

describe('AccessTokenDenylistService', () => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  it('reports a denied family while redis answers', async () => {
    expect(await aDenylist({ exists: async () => 1 }).isFamilyDenied('family')).toBe(true);
    expect(await aDenylist({ exists: async () => 0 }).isFamilyDenied('family')).toBe(false);
  });

  it('accepts the token on its signature when redis is down and fail-open is on', async () => {
    expect(await aDenylist({ status: 'reconnecting' }).isFamilyDenied('family')).toBe(false);
  });

  it('answers 503 when redis is down and fail-open is off', async () => {
    await expect(aDenylist({ status: 'reconnecting' }, false).isFamilyDenied('family')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('gives up on a redis that does not answer within the timeout', async () => {
    const startedAt = Date.now();

    expect(await aDenylist({ exists: () => new Promise(() => undefined) }).isFamilyDenied('family')).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(600);
  });

  it('fails the revocation with 503 when the denylist cannot be written and fail-open is off', async () => {
    await expect(aDenylist({ status: 'reconnecting' }, false).denyFamily('family')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('lets logout succeed when the denylist cannot be written and fail-open is on', async () => {
    await expect(aDenylist({ status: 'reconnecting' }).denyFamily('family')).resolves.toBeUndefined();
    await expect(aDenylist({ set: async () => { throw new Error('connection lost'); } }).denyFamily('family')).resolves.toBeUndefined();
  });
});
