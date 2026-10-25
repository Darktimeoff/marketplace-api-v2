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

export function stateFilePath(suite: string, set = 1): string {
  return join(tmpdir(), `marketplace-api-v2-test-db.${suite}.${set}.json`);
}

interface ContainerSetOptionsInterface {
  withBroker?: boolean;
  withKafka?: boolean;
  withTemporal?: boolean;
  withRedis?: boolean;
  sets?: number;
}

export function createDbLifecycle(suite: string, { sets = 1, ...options }: ContainerSetOptionsInterface = {}) {
  const started: StartedTestContainer[] = [];

  async function setup(): Promise<void> {
    await Promise.all(
      Array.from({ length: sets }, async (_, index) => {
        const connection = await startSet(options, started);
        await writeFile(stateFilePath(suite, index + 1), JSON.stringify(connection), 'utf-8');
      }),
    );
  }

  async function teardown(): Promise<void> {
    await Promise.all(Array.from({ length: sets }, (_, index) => unlink(stateFilePath(suite, index + 1)).catch(() => undefined)));
    await Promise.all(started.map((container) => container.stop()));
  }

  return { setup, teardown };
}

async function startSet(
  { withBroker = false, withKafka = false, withTemporal = false, withRedis = false }: ContainerSetOptionsInterface,
  started: StartedTestContainer[],
): Promise<TestDbConnection> {
  const [postgres, broker, kafka, temporal, redis] = await Promise.all([
    startPostgres(started),
    withBroker ? startBroker(started) : undefined,
    withKafka ? startKafka(started) : undefined,
    withTemporal ? startTemporal(started) : undefined,
    withRedis ? startRedisPair(started) : undefined,
  ]);

  return { ...postgres, broker, ...kafka, temporalAddress: temporal, ...redis };
}

async function startPostgres(started: StartedTestContainer[]): Promise<TestDbConnection> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('marketplace_test')
    .withUsername('test')
    .withPassword('test')
    .start();
  started.push(container);

  const connection: TestDbConnection = {
    host: container.getHost(),
    port: container.getPort(),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  };

  await runMigrations(connection);
  return connection;
}

async function startBroker(started: StartedTestContainer[]): Promise<TestBrokerConnection> {
  const broker = await new GenericContainer('rabbitmq:4.3')
    .withEnvironment({ RABBITMQ_DEFAULT_USER: 'test', RABBITMQ_DEFAULT_PASS: 'test' })
    .withExposedPorts(5672)
    .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
    .start();
  started.push(broker);
  return { host: broker.getHost(), port: broker.getMappedPort(5672), username: 'test', password: 'test' };
}

async function startKafka(started: StartedTestContainer[]): Promise<Pick<TestDbConnection, 'kafkaBrokers' | 'kafkaContainerId'>> {
  const port = await freePort();
  const kafka = await new GenericContainer('apache/kafka:4.2.0')
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
      KAFKA_HEAP_OPTS: '-Xms256m -Xmx512m',
    })
    .withWaitStrategy(Wait.forLogMessage(/Kafka Server started/))
    .start();
  started.push(kafka);
  return { kafkaBrokers: `localhost:${port}`, kafkaContainerId: kafka.getId() };
}

async function startTemporal(started: StartedTestContainer[]): Promise<string> {
  const temporal = await new GenericContainer('temporalio/temporal:1.9.1')
    .withCommand(['server', 'start-dev', '--ip=0.0.0.0', '--headless'])
    .withExposedPorts(7233)
    .withWaitStrategy(Wait.forLogMessage(/Temporal Server:/))
    .start();
  started.push(temporal);
  return `${temporal.getHost()}:${temporal.getMappedPort(7233)}`;
}

async function startRedisPair(started: StartedTestContainer[]): Promise<Pick<TestDbConnection, 'redisCacheUrl' | 'redisQueueUrl'>> {
  const [redisCache, redisQueue] = await Promise.all([
    startRedis(['--maxmemory', '64mb', '--maxmemory-policy', 'allkeys-lru', '--save', '', '--appendonly', 'no']),
    startRedis(['--maxmemory', '256mb', '--maxmemory-policy', 'noeviction', '--appendonly', 'yes', '--appendfsync', 'everysec']),
  ]);
  started.push(redisCache, redisQueue);
  return { redisCacheUrl: redisUrl(redisCache), redisQueueUrl: redisUrl(redisQueue) };
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
