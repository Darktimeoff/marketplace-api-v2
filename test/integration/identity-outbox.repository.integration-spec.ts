import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TopicEnum } from '@marketplace/messaging-contracts';
import { IdentityOutbox } from '../../src/identity/entity/identity-outbox.entity.js';
import { IdentityOutboxRepository } from '../../src/identity/repository/identity-outbox.repository.js';
import { IdentityOutboxAggregateTypeEnum } from '../../src/identity/enum/identity-outbox-aggregate-type.enum.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

@Module({
  imports: [TypeOrmModule.forFeature([IdentityOutbox])],
  providers: [IdentityOutboxRepository],
})
class IdentityOutboxTestModule {}

describe('IdentityOutboxRepository', () => {
  let testModule: TestModule;
  let outbox: IdentityOutboxRepository;
  let txHost: TransactionHost;

  beforeAll(async () => {
    testModule = await createTestModule([IdentityOutboxTestModule]);
    outbox = testModule.app.get(IdentityOutboxRepository);
    txHost = testModule.app.get(TransactionHost);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  async function aRow(createdSecondsAgo: number): Promise<string> {
    const id = randomUUID();
    await outbox.create({
      id,
      topic: TopicEnum.IDENTITY_EVENTS,
      aggregateType: IdentityOutboxAggregateTypeEnum.IDENTITY,
      aggregateId: id,
      type: 'identity.registered',
      payload: { identityPublicId: id },
    });
    await testModule.dataSource.query(
      `UPDATE "IdentityOutbox" SET "createdAt" = now() - make_interval(secs => $2) WHERE "id" = $1`,
      [id, createdSecondsAgo],
    );
    return id;
  }

  function claim(limit: number): Promise<string[]> {
    return txHost.withTransaction(async () => (await outbox.claimUnpublished(limit)).map(({ id }) => id));
  }

  it('claims unpublished rows oldest first and skips published ones', async () => {
    const newest = await aRow(10);
    const oldest = await aRow(30);
    const published = await aRow(20);
    await outbox.markPublished([published]);

    expect(await claim(10)).toEqual([oldest, newest]);
  });

  it('never hands the same row to two concurrent claims (FOR UPDATE SKIP LOCKED)', async () => {
    const ids = [await aRow(40), await aRow(30), await aRow(20), await aRow(10)];
    let release!: () => void;
    let claimedFirst!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const firstClaimed = new Promise<void>((resolve) => { claimedFirst = resolve; });
    let first: string[] = [];

    const firstTransaction = txHost.withTransaction(async () => {
      first = (await outbox.claimUnpublished(2)).map(({ id }) => id);
      claimedFirst();
      await held;
    });
    await firstClaimed;

    const second = await claim(10);
    release();
    await firstTransaction;

    expect(first).toEqual(ids.slice(0, 2));
    expect(second).toEqual(ids.slice(2));
  });

  it('records a failed attempt and later publication', async () => {
    const id = await aRow(10);

    await outbox.recordFailure(id, 'broker down');
    await outbox.recordFailure(id, 'still down');
    await outbox.markPublished([id]);

    const row = await testModule.dataSource.getRepository(IdentityOutbox).findOneByOrFail({ id });
    expect(row).toMatchObject({ attempts: 2, lastError: 'still down' });
    expect(row.publishedAt).toBeInstanceOf(Date);
  });

  it('deletes only rows published before the cutoff', async () => {
    const oldPublished = await aRow(3600);
    const recentPublished = await aRow(10);
    const oldUnpublished = await aRow(3600);
    await outbox.markPublished([oldPublished, recentPublished]);
    await testModule.dataSource.query(`UPDATE "IdentityOutbox" SET "publishedAt" = "createdAt" WHERE "id" = $1`, [oldPublished]);

    const deleted = await outbox.deletePublishedBefore(new Date(Date.now() - 60 * 1000));

    expect(deleted).toBe(1);
    const remaining = (await testModule.dataSource.getRepository(IdentityOutbox).find()).map(({ id }) => id).toSorted();
    expect(remaining).toEqual([recentPublished, oldUnpublished].toSorted());
  });
});
