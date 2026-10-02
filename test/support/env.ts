import { readFile } from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
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

const signingKeys = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.JWT_PRIVATE_KEY = signingKeys.privateKey;
process.env.JWT_PUBLIC_KEY = signingKeys.publicKey;

if (connection.broker) {
  process.env.RABBITMQ_HOST = connection.broker.host;
  process.env.RABBITMQ_PORT = String(connection.broker.port);
  process.env.RABBITMQ_USER = connection.broker.username;
  process.env.RABBITMQ_PASSWORD = connection.broker.password;
}
