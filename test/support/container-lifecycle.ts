import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { createServer } from 'node:net';
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
  kafkaBrokers?: string;
  kafkaContainerId?: string;
  temporalAddress?: string;
  redisCacheUrl?: string;
  redisQueueUrl?: string;
}

export function stateFilePath(suite: string): string {
  return join(tmpdir(), `marketplace-api-v2-test-db.${suite}.json`);
}

export function createDbLifecycle(suite: string, { withBroker = false, withKafka = false, withTemporal = false, withRedis = false }: { withBroker?: boolean; withKafka?: boolean; withTemporal?: boolean; withRedis?: boolean } = {}) {
  let container: StartedPostgreSqlContainer | undefined;
  let broker: StartedTestContainer | undefined;
  let kafka: StartedTestContainer | undefined;
  let temporal: StartedTestContainer | undefined;
  let redisCache: StartedTestContainer | undefined;
  let redisQueue: StartedTestContainer | undefined;

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

    if (withKafka) {
      const port = await freePort();
      kafka = await new GenericContainer('apache/kafka:4.2.0')
        .withExposedPorts({ container: 9092, host: port })
        .withEnvironment({
          KAFKA_NODE_ID: '1',
          KAFKA_PROCESS_ROLES: 'broker,controller',
          KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:9093',
          KAFKA_LISTENERS: 'PLAINTEXT://:9092,INTERNAL://:29092,CONTROLLER://:9093',
          KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://localhost:${port},INTERNAL://localhost:29092`,
          KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'PLAINTEXT:PLAINTEXT,INTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT',
          KAFKA_INTER_BROKER_LISTENER_NAME: 'INTERNAL',
          KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
          KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'false',
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
          KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
          KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
          KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: '0',
        })
        .withWaitStrategy(Wait.forLogMessage(/Kafka Server started/))
        .start();
      connection.kafkaBrokers = `localhost:${port}`;
      connection.kafkaContainerId = kafka.getId();
    }

    if (withTemporal) {
      temporal = await new GenericContainer('temporalio/temporal:1.9.1')
        .withCommand(['server', 'start-dev', '--ip=0.0.0.0', '--headless'])
        .withExposedPorts(7233)
        .withWaitStrategy(Wait.forLogMessage(/Temporal Server:/))
        .start();
      connection.temporalAddress = `${temporal.getHost()}:${temporal.getMappedPort(7233)}`;
    }

    if (withRedis) {
      redisCache = await startRedis(['--maxmemory', '64mb', '--maxmemory-policy', 'allkeys-lru', '--save', '', '--appendonly', 'no']);
      redisQueue = await startRedis(['--maxmemory', '256mb', '--maxmemory-policy', 'noeviction', '--appendonly', 'yes', '--appendfsync', 'everysec']);
      connection.redisCacheUrl = redisUrl(redisCache);
      connection.redisQueueUrl = redisUrl(redisQueue);
    }

    await writeFile(stateFilePath(suite), JSON.stringify(connection), 'utf-8');
  }

  async function teardown(): Promise<void> {
    await unlink(stateFilePath(suite)).catch(() => undefined);
    await broker?.stop();
    await kafka?.stop();
    await temporal?.stop();
    await redisCache?.stop();
    await redisQueue?.stop();
    await container?.stop();
  }

  return { setup, teardown };
}

const REDIS_TEST_PASSWORD = 'test';

function startRedis(args: string[]): Promise<StartedTestContainer> {
  return new GenericContainer('redis:8.4.1-alpine')
    .withCommand(['redis-server', ...args, '--requirepass', REDIS_TEST_PASSWORD])
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
}

function redisUrl(container: StartedTestContainer): string {
  return `redis://default:${REDIS_TEST_PASSWORD}@${container.getHost()}:${container.getMappedPort(6379)}`;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
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
