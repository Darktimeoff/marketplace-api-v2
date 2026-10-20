import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseEnvFile } from 'dotenv';
import { createAuthenticatedInfisicalClient } from './lib/infisical.mjs';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const envPath = path.join(rootDir, '.env');
const dbPasswordPath = path.join(rootDir, 'secrets', 'db_password.txt');
const rabbitmqPasswordPath = path.join(rootDir, 'secrets', 'rabbitmq_password.txt');
const redisPasswordPath = path.join(rootDir, 'secrets', 'redis_password.txt');

async function main() {
  const envSource = await readFile(envPath, 'utf8');
  const env = { ...parseEnvFile(envSource), ...process.env };

  const client = await createAuthenticatedInfisicalClient(env, rootDir);

  const { secrets } = await client.secrets().listSecrets({
    projectId: env.INFISICAL_PROJECT_ID,
    environment: env.INFISICAL_ENVIRONMENT,
  });
  const secretsMap = Object.fromEntries(secrets.map((secret) => [secret.secretKey, secret.secretValue]));

  for (const key of ['DBUSER', 'DBPASSWORD', 'RABBITMQ_PASSWORD', 'RABBITMQ_USER', 'REDIS_CACHE_URL', 'REDIS_QUEUE_URL']) {
    if (!secretsMap[key]) {
      throw new Error(`Infisical project/environment is missing the "${key}" secret`);
    }
  }

  await writeFileAtomic(dbPasswordPath, secretsMap.DBPASSWORD, { mode: 0o600 });
  await writeFileAtomic(rabbitmqPasswordPath, secretsMap.RABBITMQ_PASSWORD, { mode: 0o600 });
  await writeFileAtomic(redisPasswordPath, redisPassword(secretsMap.REDIS_CACHE_URL, secretsMap.REDIS_QUEUE_URL), { mode: 0o600 });

  await writeFileAtomic(envPath, upsertEnvVar(upsertEnvVar(envSource, 'DBUSER', secretsMap.DBUSER), 'RABBITMQ_USER', secretsMap.RABBITMQ_USER));

  console.log(
    `Pulled DBUSER and DBPASSWORD from Infisical (${env.INFISICAL_ENVIRONMENT}) into ${path.relative(rootDir, envPath)} and ${path.relative(rootDir, dbPasswordPath)}.`,
  );
}

function redisPassword(...urls) {
  const passwords = new Set(urls.map((url) => decodeURIComponent(new URL(url).password)));

  if (passwords.size !== 1 || passwords.has('')) {
    throw new Error('REDIS_CACHE_URL and REDIS_QUEUE_URL must carry the same non-empty password');
  }

  return [...passwords][0];
}

function upsertEnvVar(envSource, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(envSource)) {
    return envSource.replace(pattern, line);
  }

  const separator = envSource.length > 0 && !envSource.endsWith('\n') ? '\n' : '';
  return `${envSource}${separator}${line}\n`;
}

async function writeFileAtomic(filePath, content, options) {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, content, options);
  await rename(tmpPath, filePath);
}

main().catch((error) => {
  console.error('Failed to bootstrap db secrets from Infisical:', error.message);
  process.exit(1);
});
