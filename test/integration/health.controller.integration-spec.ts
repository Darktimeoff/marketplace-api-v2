import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthModule } from '../../src/health/health.module.js';
import { HealthController } from '../../src/health/health.controller.js';
import { createTestModule, type TestModule } from '../support/test-module.js';

describe('HealthController', () => {
  let testModule: TestModule;
  let controller: HealthController;

  beforeAll(async () => {
    testModule = await createTestModule([HealthModule]);
    controller = testModule.app.get(HealthController);
  });

  afterAll(async () => {
    await testModule.close();
  });

  it('is ready while Postgres answers the ping', async () => {
    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ok',
      details: { shutdown: { status: 'up' }, database: { status: 'up' } },
    });
  });

  it('is not ready once Postgres is gone, but stays alive', async () => {
    await testModule.dataSource.destroy();

    const failure = await controller.ready().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect((failure as ServiceUnavailableException).getResponse()).toMatchObject({
      status: 'error',
      error: { database: { status: 'down' } },
    });
    await expect(controller.live()).resolves.toMatchObject({ status: 'ok' });
  });
});
