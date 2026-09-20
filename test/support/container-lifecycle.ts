import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { testEntities, testMigrations } from './migrations.js';

export interface TestDbConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function stateFilePath(suite: string): string {
  return join(tmpdir(), `marketplace-api-v2-test-db.${suite}.json`);
}

export function createDbLifecycle(suite: string) {
  let container: StartedPostgreSqlContainer | undefined;

  async function setup(): Promise<void> {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('marketplace_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const connection: TestDbConnection = {
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    };

    await runMigrations(connection);
    await writeFile(stateFilePath(suite), JSON.stringify(connection), 'utf-8');
  }

  async function teardown(): Promise<void> {
    await unlink(stateFilePath(suite)).catch(() => undefined);
    await container?.stop();
  }

  return { setup, teardown };
}

async function runMigrations(connection: TestDbConnection): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    ...connection,
    entities: testEntities,
    migrations: testMigrations,
    migrationsTableName: 'migrations',
  });

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
