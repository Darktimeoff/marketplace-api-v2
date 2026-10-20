// TODO(hw-23): remove after homework, npm run demo:session
import { setTimeout as sleep } from 'node:timers/promises';
import { startDemoApp, report, run } from './demo-harness.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AccessTokenVerifierService } from '../generic/auth/access-token-verifier.service.js';
import { RedisClientService } from '../generic/redis/redis-client.service.js';

const LOGIN = { login: 'buyer1@example.com', password: 'marketplace-dev' };
const ACTIVE_REQUESTS = 5;

await run(async () => {
  const first = await startDemoApp([IdentityModule]);
  const login = await fetch(`${await first.getUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });

  if (login.status !== 200) {
    await first.close();
    throw new Error(`login failed with ${login.status}: run npm run seed first`);
  }

  const { accessToken, refreshToken } = (await login.json()) as { accessToken: string; refreshToken: string };
  const sessionIds = new Set<string>();
  let requests = 0;

  async function authenticated(app: typeof first): Promise<boolean> {
    requests += 1;
    try {
      sessionIds.add((await app.get(AccessTokenVerifierService).verify(accessToken)).tokenId);
      return true;
    } catch {
      return false;
    }
  }

  await authenticated(first);
  const sessionKey = `session:${[...sessionIds][0]}`;
  const inRedis = await first.get(RedisClientService).queue.exists(sessionKey);

  await sleep(2000);
  const ttlBefore = await first.get(RedisClientService).queue.ttl(sessionKey);
  for (let i = 0; i < ACTIVE_REQUESTS; i += 1) {
    await authenticated(first);
  }
  const ttlAfter = await first.get(RedisClientService).queue.ttl(sessionKey);
  await first.close();

  const second = await startDemoApp([IdentityModule]);
  const survivesRestart = await authenticated(second);
  await fetch(`${await second.getUrl()}/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const deadAfterLogout = !(await authenticated(second));
  await second.close();

  return report(
    {
      requests,
      sessions: sessionIds.size,
      'in-redis': inRedis,
      'ttl-before': ttlBefore,
      'ttl-after': ttlAfter,
      'ttl-renewed': ttlAfter > ttlBefore ? 1 : 0,
      'survives-restart': survivesRestart ? 1 : 0,
      'revoked-on-logout': deadAfterLogout ? 1 : 0,
    },
    [
      ['one session for every request', sessionIds.size === 1],
      ['the session lives in redis', inRedis === 1],
      ['activity extends the ttl', ttlAfter > ttlBefore],
      ['the session survives an app restart', survivesRestart],
      ['logout kills the access token', deadAfterLogout],
    ],
  );
});
