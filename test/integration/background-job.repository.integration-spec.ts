import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BackgroundJobModule } from '../../src/background-job/background-job.module.js';
import { BackgroundJobRepository } from '../../src/background-job/repository/background-job.repository.js';
import {
  BackgroundJobStatusEnum,
  BackgroundJobTypeEnum,
} from '../../src/entities/enums.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';
import { aBackgroundJobInput } from '../support/builders.js';

describe('BackgroundJobRepository', () => {
  let testModule: TestModule;
  let repository: BackgroundJobRepository;

  beforeAll(async () => {
    testModule = await createTestModule([BackgroundJobModule]);
    repository = testModule.app.get(BackgroundJobRepository);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  it('rejects a second job with the same dedupeKey (unique constraint)', async () => {
    const dedupeKey = 'order-42';
    await repository.create(aBackgroundJobInput({ dedupeKey }));

    await expect(
      repository.create(aBackgroundJobInput({ dedupeKey })),
    ).rejects.toThrow(/duplicate key value/);
  });

  it('rejects a job referencing a non-existent order (FK constraint)', async () => {
    await expect(
      repository.create(aBackgroundJobInput({ orderId: 999999 })),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it('claimNext claims the oldest queued job and skips already-claimed ones', async () => {
    const older = await repository.create(aBackgroundJobInput());
    await repository.create(aBackgroundJobInput());

    const claimed = await repository.claimNext(
      BackgroundJobTypeEnum.ORDER,
      'worker-1',
    );

    expect(claimed?.id).toBe(older.id);
    expect(claimed?.status).toBe(BackgroundJobStatusEnum.PROCESSING);
    expect(claimed?.attempts).toBe(1);
    expect(claimed?.processedBy).toBe('worker-1');

    const second = await repository.claimNext(
      BackgroundJobTypeEnum.ORDER,
      'worker-2',
    );
    expect(second?.id).not.toBe(older.id);

    const third = await repository.claimNext(
      BackgroundJobTypeEnum.ORDER,
      'worker-3',
    );
    expect(third).toBeNull();
  });

  it('countPending aggregates queued and processing jobs by status', async () => {
    await repository.create(aBackgroundJobInput());
    await repository.create(aBackgroundJobInput());
    const processing = await repository.create(aBackgroundJobInput());
    await repository.claimNext(BackgroundJobTypeEnum.ORDER, 'worker-1');

    const depth = await repository.countPending(BackgroundJobTypeEnum.ORDER);

    expect(depth.queued).toBe(2);
    expect(depth.processing).toBe(1);
    expect(processing).toBeDefined();
  });
});
