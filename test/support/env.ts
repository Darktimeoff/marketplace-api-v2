import { readFile } from 'node:fs/promises';
import { stateFilePath, type TestDbConnection } from './container-lifecycle.js';

const suite = process.env.TEST_SUITE;
if (!suite) {
  throw new Error(
    'TEST_SUITE env var is not set — configure it in the vitest config that loads this setup file',
  );
}

const raw = await readFile(stateFilePath(suite), 'utf-8');
const connection: TestDbConnection = JSON.parse(raw);

process.env.SKIP_VAULT = '1';
process.env.DBHOST = connection.host;
process.env.DBPORT = String(connection.port);
process.env.DBUSER = connection.username;
process.env.DBPASSWORD = connection.password;
process.env.DBNAME = connection.database;
process.env.INFISICAL_ENVIRONMENT = 'dev';
process.env.INFISICAL_CLIENT_ID = 'test';
process.env.INFISICAL_SITE_URL = 'http://localhost:4010';
process.env.INFISICAL_PROJECT_ID = 'test';
process.env.WORKER_POOL_SIZE = '4';
