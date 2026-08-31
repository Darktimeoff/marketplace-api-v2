import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseEnvFile } from 'dotenv';
import { createAuthenticatedInfisicalClient } from './lib/infisical.mjs';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const envPath = path.join(rootDir, '.env');
const dbPasswordPath = path.join(rootDir, 'secrets', 'db_password.txt');

async function main() {
  const envSource = await readFile(envPath, 'utf8');
  const env = { ...parseEnvFile(envSource), ...process.env };

  const client = await createAuthenticatedInfisicalClient(env, rootDir);

  const { secrets } = await client.secrets().listSecrets({
    projectId: env.INFISICAL_PROJECT_ID,
    environment: env.INFISICAL_ENVIRONMENT,
  });
  const secretsMap = Object.fromEntries(secrets.map((secret) => [secret.secretKey, secret.secretValue]));

  for (const key of ['DBUSER', 'DBPASSWORD']) {
    if (!secretsMap[key]) {
      throw new Error(`Infisical project/environment is missing the "${key}" secret`);
    }
  }

  await writeFileAtomic(dbPasswordPath, secretsMap.DBPASSWORD, { mode: 0o600 });

  const updatedEnvSource = upsertEnvVar(envSource, 'DBUSER', secretsMap.DBUSER);
  await writeFileAtomic(envPath, updatedEnvSource);

  console.log(
    `Pulled DBUSER and DBPASSWORD from Infisical (${env.INFISICAL_ENVIRONMENT}) into ${path.relative(rootDir, envPath)} and ${path.relative(rootDir, dbPasswordPath)}.`,
  );
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
