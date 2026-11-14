import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { InfisicalSDK } from '@infisical/sdk';

const REQUIRED_ENV_KEYS = ['INFISICAL_SITE_URL', 'INFISICAL_PROJECT_ID', 'INFISICAL_ENVIRONMENT'];

export async function createAuthenticatedInfisicalClient(env, rootDir, identity = 'app') {
  const clientIdKey = identity === 'admin' ? 'INFISICAL_ADMIN_CLIENT_ID' : 'INFISICAL_CLIENT_ID';

  for (const key of [...REQUIRED_ENV_KEYS, clientIdKey]) {
    if (!env[key]) {
      throw new Error(`Missing required "${key}" in .env`);
    }
  }

  const clientSecretPath = path.join(rootDir, 'secrets', identity === 'admin' ? 'infisical_admin_client_secret.txt' : 'infisical_client_secret.txt');
  const clientSecret = (await readFile(clientSecretPath, 'utf8')).trim();

  const client = new InfisicalSDK({ siteUrl: env.INFISICAL_SITE_URL });
  await client.auth().universalAuth.login({
    clientId: env[clientIdKey],
    clientSecret,
  });

  return client;
}
