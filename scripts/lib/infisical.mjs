import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { InfisicalSDK } from '@infisical/sdk';

const REQUIRED_ENV_KEYS = ['INFISICAL_SITE_URL', 'INFISICAL_CLIENT_ID', 'INFISICAL_PROJECT_ID', 'INFISICAL_ENVIRONMENT'];

export async function createAuthenticatedInfisicalClient(env, rootDir) {
  for (const key of REQUIRED_ENV_KEYS) {
    if (!env[key]) {
      throw new Error(`Missing required "${key}" in .env`);
    }
  }

  const clientSecretPath = path.join(rootDir, 'secrets', 'infisical_client_secret.txt');
  const clientSecret = (await readFile(clientSecretPath, 'utf8')).trim();

  const client = new InfisicalSDK({ siteUrl: env.INFISICAL_SITE_URL });
  await client.auth().universalAuth.login({
    clientId: env.INFISICAL_CLIENT_ID,
    clientSecret,
  });

  return client;
}
