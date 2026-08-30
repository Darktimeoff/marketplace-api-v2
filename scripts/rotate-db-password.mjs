import { randomBytes } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseEnvFile } from 'dotenv';
import { Client } from 'pg';
import { createAuthenticatedInfisicalClient } from './lib/infisical.mjs';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const envPath = path.join(rootDir, '.env');
const secretPath = path.join(rootDir, 'secrets', 'db_password.txt');

function generatePassword() {
  return randomBytes(24).toString('base64url');
}

async function pushPasswordToInfisical(env, newPassword) {
  const client = await createAuthenticatedInfisicalClient(env, rootDir);

  await client.secrets().updateSecret('DBPASSWORD', {
    projectId: env.INFISICAL_PROJECT_ID,
    environment: env.INFISICAL_ENVIRONMENT,
    secretValue: newPassword,
  });
}

async function main() {
  const env = { ...parseEnvFile(await readFile(envPath, 'utf8')), ...process.env };
  const host = env.DBHOST;
  const port = Number(env.DBPORT);
  const user = env.DBUSER;
  const database = env.DBNAME;

  const oldPassword = (await readFile(secretPath, 'utf8')).trim();
  const newPassword = generatePassword();

  const client = new Client({ host, port, user, database, password: oldPassword });
  await client.connect();

  let terminatedCount = 0;
  try {
    await client.query(`ALTER USER "${user}" WITH PASSWORD '${newPassword}'`);

    // Write the new secret to disk before terminating other sessions, so that
    // any pool which reconnects immediately reads the already-updated password.
    const tmpPath = `${secretPath}.tmp`;
    await writeFile(tmpPath, newPassword, { mode: 0o600 });
    await rename(tmpPath, secretPath);

    const { rows } = await client.query(
      `SELECT pg_terminate_backend(pid) AS terminated
       FROM pg_stat_activity
       WHERE usename = $1 AND pid <> pg_backend_pid()`,
      [user],
    );
    terminatedCount = rows.filter((row) => row.terminated).length;
  } finally {
    await client.end();
  }

  console.log(
    `Rotated password for role "${user}", updated ${path.relative(rootDir, secretPath)}, and terminated ${terminatedCount} existing session(s).`,
  );

  try {
    await pushPasswordToInfisical(env, newPassword);
  } catch (error) {
    console.error(
      `Rotated the db password locally, but failed to sync it to Infisical: ${error.message}. Infisical's DBPASSWORD secret is now stale - update it manually.`,
    );
    process.exit(1);
  }

  console.log(`Synced the new password to Infisical (${env.INFISICAL_ENVIRONMENT}) secret "DBPASSWORD".`);
}

main().catch((error) => {
  console.error('Failed to rotate the db password:', error.message);
  process.exit(1);
});
