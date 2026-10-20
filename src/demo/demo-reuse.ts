// TODO(hw-24): remove after homework, npm run demo:reuse
import { run, report } from './demo-harness.js';

await run(async (client) => {
  const { email } = await client.register();
  const login = await client.call('POST', '/auth/login', { body: { login: email, password: 'demo-password-1' } });
  const r1 = login.body.refreshToken;
  const r1Refresh = await client.call('POST', '/auth/refresh', { body: { refreshToken: r1 } });
  const r2 = r1Refresh.body.refreshToken;
  const r1Reuse = await client.call('POST', '/auth/refresh', { body: { refreshToken: r1 } });
  const r2AfterReuse = await client.call('POST', '/auth/refresh', { body: { refreshToken: r2 } });

  return report(
    {
      login: login.status,
      'r1-refresh': r1Refresh.status,
      'r1-reuse': r1Reuse.status,
      'r2-after-reuse': r2AfterReuse.status,
    },
    [
      ['login succeeds', login.status === 200],
      ['the first refresh rotates', r1Refresh.status === 200],
      ['a used token is refused', r1Reuse.status === 401],
      ['the whole family dies with it', r2AfterReuse.status === 401],
    ],
  );
});
