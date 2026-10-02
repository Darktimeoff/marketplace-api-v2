import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { testEntities, testMigrations } from './migrations.js';

export interface TestBrokerConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface TestDbConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  broker?: TestBrokerConnection;
}

export function stateFilePath(suite: string): string {
  return join(tmpdir(), `marketplace-api-v2-test-db.${suite}.json`);
}

export function createDbLifecycle(suite: string, { withBroker = false }: { withBroker?: boolean } = {}) {
  let container: StartedPostgreSqlContainer | undefined;
  let broker: StartedTestContainer | undefined;

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

    if (withBroker) {
      broker = await new GenericContainer('rabbitmq:4.3')
        .withEnvironment({ RABBITMQ_DEFAULT_USER: 'test', RABBITMQ_DEFAULT_PASS: 'test' })
        .withExposedPorts(5672)
        .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
        .start();
      connection.broker = { host: broker.getHost(), port: broker.getMappedPort(5672), username: 'test', password: 'test' };
    }

    await writeFile(stateFilePath(suite), JSON.stringify(connection), 'utf-8');
  }

  async function teardown(): Promise<void> {
    await unlink(stateFilePath(suite)).catch(() => undefined);
    await broker?.stop();
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
