// TODO(hw-24): remove after homework, npm run demo:auth
import { run, report } from './demo-harness.js';

await run(async (client) => {
  const { email } = await client.register();
  const login = await client.call('POST', '/auth/login', { body: { login: email, password: 'demo-password-1' } });
  const noToken = await client.call('GET', '/auth/me');
  const withToken = await client.call('GET', '/auth/me', { token: String(login.body.accessToken) });
  const refresh = await client.call('POST', '/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
  const logout = await client.call('POST', '/auth/logout', { body: { refreshToken: refresh.body.refreshToken } });
  const afterLogout = await client.call('GET', '/auth/me', { token: String(refresh.body.accessToken) });
  const refreshAfterLogout = await client.call('POST', '/auth/refresh', { body: { refreshToken: refresh.body.refreshToken } });

  return report(
    {
      login: login.status,
      'no-token': noToken.status,
      'with-token': withToken.status,
      refresh: refresh.status,
      logout: logout.status,
      'after-logout': afterLogout.status,
      'refresh-after-logout': refreshAfterLogout.status,
    },
    [
      ['login succeeds', login.status === 200],
      ['no token is 401', noToken.status === 401],
      ['a token gets in', withToken.status === 200],
      ['refresh rotates', refresh.status === 200],
      ['logout succeeds', logout.status === 200 || logout.status === 204],
      ['the access token dies on logout', afterLogout.status === 401],
      ['the refresh token dies on logout', refreshAfterLogout.status === 401],
    ],
  );
});
