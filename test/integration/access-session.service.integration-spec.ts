import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AuthModule } from '../../src/generic/auth/auth.module.js';
import { AccessSessionService } from '../../src/generic/auth/access-session.service.js';
import { RedisClientService } from '../../src/generic/redis/redis-client.service.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

describe('AccessSessionService', () => {
  let testModule: TestModule;
  let sessions: AccessSessionService;

  beforeAll(async () => {
    testModule = await createTestModule([AuthModule]);
    sessions = testModule.app.get(AccessSessionService);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  it('opens a session and extends it on touch', async () => {
    const tokenId = randomUUID();

    expect(await sessions.open(tokenId, randomUUID())).toBe(true);
    await testModule.app.get(RedisClientService).queue.expire(`session:${tokenId}`, 10);

    expect(await sessions.touch(tokenId)).toBe(true);
    expect(await testModule.app.get(RedisClientService).queue.ttl(`session:${tokenId}`)).toBeGreaterThan(290);
  });

  it('rejects every session of a revoked family', async () => {
    const familyId = randomUUID();
    const tokenIds = [randomUUID(), randomUUID()];
    for (const tokenId of tokenIds) {
      await sessions.open(tokenId, familyId);
    }

    await sessions.revokeFamily(familyId);

    expect(await Promise.all(tokenIds.map((tokenId) => sessions.touch(tokenId)))).toEqual([false, false]);
  });

  it('refuses a session opened after its family was revoked', async () => {
    const familyId = randomUUID();
    const late = randomUUID();
    await sessions.revokeFamily(familyId);

    expect(await sessions.open(late, familyId)).toBe(false);
    expect(await sessions.touch(late)).toBe(false);
  });

  it('rejects a session that survived the delete when its family is revoked', async () => {
    const familyId = randomUUID();
    const survivor = randomUUID();
    await testModule.app.get(RedisClientService).queue.set(`session:${survivor}`, familyId, 'EX', 300);

    await sessions.revokeFamily(familyId);

    expect(await sessions.touch(survivor)).toBe(false);
  });

  it('keeps the tombstone at least as long as any token of the family can live', async () => {
    const familyId = randomUUID();

    await sessions.revokeFamily(familyId);

    expect(await testModule.app.get(RedisClientService).queue.ttl(`session-family-revoked:${familyId}`)).toBeGreaterThanOrEqual(900);
  });

  it('leaves other families alone', async () => {
    const kept = randomUUID();
    await sessions.open(kept, randomUUID());

    await sessions.revokeFamily(randomUUID());

    expect(await sessions.touch(kept)).toBe(true);
  });
});
