// TODO(hw-23): remove after homework, npm run demo:ratelimit
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { startDemoApp, report, run } from './demo-harness.js';
import { IdentityModule } from '../identity/identity.module.js';
import { IDENTITY_LOGIN_THROTTLE_LIMIT } from '../identity/constant/identity-login-throttle.constant.js';

const INSTANCES = 2;
const REQUESTS = 8;

await run(async () => {
  const pods: INestApplication[] = [];
  for (let i = 0; i < INSTANCES; i += 1) {
    pods.push(await startDemoApp([IdentityModule]));
  }

  const login = `ratelimit-demo-${randomUUID()}@example.com`;
  const statuses: number[] = [];
  let lastBlocked: Response | undefined;

  try {
    for (let i = 0; i < REQUESTS; i += 1) {
      const response = await fetch(`${await pods[i % INSTANCES].getUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, password: 'wrong-password' }),
      });
      statuses.push(response.status);
      if (response.status === 429) {
        lastBlocked = response;
      }
    }
  } finally {
    for (const pod of pods) {
      await pod.close();
    }
  }

  const blocked = statuses.filter((status) => status === 429).length;
  const retryAfter = Number(lastBlocked?.headers.get('retry-after'));

  return report(
    {
      instances: INSTANCES,
      limit: IDENTITY_LOGIN_THROTTLE_LIMIT,
      requests: REQUESTS,
      allowed: REQUESTS - blocked,
      blocked,
      status: lastBlocked?.status ?? 0,
      'retry-after': Number.isFinite(retryAfter) && retryAfter > 0 ? 1 : 0,
      'retry-after-seconds': Number.isFinite(retryAfter) ? retryAfter : 0,
    },
    [
      ['two pods share one limit', REQUESTS - blocked === IDENTITY_LOGIN_THROTTLE_LIMIT],
      ['the rest is blocked with 429', lastBlocked?.status === 429 && blocked === REQUESTS - IDENTITY_LOGIN_THROTTLE_LIMIT],
      ['Retry-After is set', Number.isFinite(retryAfter) && retryAfter > 0],
    ],
  );
});
