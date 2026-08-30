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

async function getSecret(infisical, env, secretName) {
  const secret = await infisical.secrets().getSecret({
    projectId: env.INFISICAL_PROJECT_ID,
    environment: env.INFISICAL_ENVIRONMENT,
    secretName,
  });
  return secret.secretValue;
}

async function readCurrentPassword(infisical, env) {
  try {
    return await getSecret(infisical, env, 'DBPASSWORD');
  } catch (error) {
    console.error(
      `Could not read the current DBPASSWORD from Infisical (${error.message}); falling back to ${path.relative(rootDir, secretPath)}.`,
    );
    return (await readFile(secretPath, 'utf8')).trim();
  }
}

async function main() {
  const env = { ...parseEnvFile(await readFile(envPath, 'utf8')), ...process.env };
  const host = env.DBHOST;
  const port = Number(env.DBPORT);
  const user = env.DBUSER;
  const database = env.DBNAME;

  const infisical = await createAuthenticatedInfisicalClient(env, rootDir);

  const oldPassword = await readCurrentPassword(infisical, env);
  const newPassword = generatePassword();

  const client = new Client({ host, port, user, database, password: oldPassword });
  await client.connect();

  try {
    await client.query(`ALTER USER "${user}" WITH PASSWORD '${newPassword}'`);

    const tmpPath = `${secretPath}.tmp`;
    await writeFile(tmpPath, newPassword, { mode: 0o600 });
    await rename(tmpPath, secretPath);

    console.log(`Rotated password for role "${user}" and updated ${path.relative(rootDir, secretPath)}.`);

    try {
      await infisical.secrets().updateSecret('DBPASSWORD', {
        projectId: env.INFISICAL_PROJECT_ID,
        environment: env.INFISICAL_ENVIRONMENT,
        secretValue: newPassword,
      });
    } catch (error) {
      throw new Error(
        `Rotated the db password locally, but failed to sync it to Infisical: ${error.message}. ` +
          `Infisical's DBPASSWORD secret is now stale - update it manually, then re-run this script ` +
          `to terminate the remaining old-password sessions.`,
      );
    }
    console.log(`Synced the new password to Infisical (${env.INFISICAL_ENVIRONMENT}) secret "DBPASSWORD".`);

    const { rows } = await client.query(
      `SELECT pg_terminate_backend(pid) AS terminated
       FROM pg_stat_activity
       WHERE usename = $1 AND pid <> pg_backend_pid()`,
      [user],
    );
    const terminatedCount = rows.filter((row) => row.terminated).length;
    console.log(`Terminated ${terminatedCount} existing session(s) for role "${user}".`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
