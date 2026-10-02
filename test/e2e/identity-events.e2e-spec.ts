import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { getContainerRuntimeClient } from 'testcontainers';
import { CLOUD_EVENT_CONTENT_TYPE, IdentityRegisteredEvent, TopicEnum } from '@marketplace/messaging-contracts';
import { CountryCodeEnum } from '@marketplace/contracts-core';
import { AppModule } from '../../src/app.module.js';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { KafkaProducerService } from '../../src/generic/kafka/kafka-producer.service.js';
import { truncateAllTables } from '../support/isolation.js';

interface ReceivedInterface {
  key: string | undefined;
  contentType: string | undefined;
  ceType: string | undefined;
  event: IdentityRegisteredEvent.MessageType;
}

describe('Identity events (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kafka: KafkaJS.Kafka;
  let consumer: KafkaJS.Consumer;
  const received: ReceivedInterface[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: [process.env.KAFKA_BROKERS as string], logLevel: KafkaJS.logLevel.NOTHING } });
    consumer = kafka.consumer({ kafkaJS: { groupId: `identity-events-test-${randomUUID()}`, fromBeginning: true } });
    await consumer.connect();
    await consumer.subscribe({ topic: TopicEnum.IDENTITY_EVENTS });
    await consumer.run({
      eachMessage: async ({ message }) => {
        received.push({
          key: message.key?.toString(),
          contentType: message.headers?.['content-type']?.toString(),
          ceType: message.headers?.ce_type?.toString(),
          event: JSON.parse(message.value?.toString() ?? 'null'),
        });
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await consumer.disconnect();
    await app.close();
  });

  function register(body: object) {
    return request(app.getHttpServer()).post('/auth/register').send(body);
  }

  async function eventFor(identityPublicId: string): Promise<ReceivedInterface> {
    return vi.waitFor(() => {
      const match = received.find(({ event }) => event.data.identityPublicId === identityPublicId);
      if (!match) throw new Error(`no ${IdentityRegisteredEvent.TYPE} for identity ${identityPublicId} yet`);
      return match;
    }, { timeout: 15000, interval: 100 });
  }

  it('publishes identity.registered as a structured CloudEvent keyed by the public id', async () => {
    const email = `jane-${randomUUID()}@example.com`;
    await register({ email, password: 'correct-horse' }).expect(201);
    const identity = await dataSource.getRepository(Identity).findOneByOrFail({ email });

    const { key, contentType, ceType, event } = await eventFor(identity.publicId);

    expect(identity.publicId).toMatch(/^[0-9a-f-]{36}$/);
    expect(key).toBe(identity.publicId);
    expect(contentType).toBe(CLOUD_EVENT_CONTENT_TYPE);
    expect(ceType).toBe(IdentityRegisteredEvent.TYPE);
    expect(event).toEqual({
      specversion: '1.0',
      id: identity.publicId,
      source: '/identity-service',
      type: 'identity.registered',
      time: identity.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: identity.publicId,
      correlationid: identity.publicId,
      data: { identityPublicId: identity.publicId, email, phoneNumber: null },
    });
  });

  it('carries the phone of an identity registered by phone', async () => {
    const fullNumber = `+38050${String(Date.now()).slice(-7)}`;
    await register({
      phone: { countryCode: CountryCodeEnum.UA, rawNumber: fullNumber, fullNumber, nationalNumber: `0${fullNumber.slice(4)}` },
      password: 'correct-horse',
    }).expect(201);
    const identity = await dataSource.getRepository(Identity).findOneByOrFail({ loginPhone: { fullNumber } });

    const { event } = await eventFor(identity.publicId);

    expect(event.data).toEqual({ identityPublicId: identity.publicId, email: null, phoneNumber: fullNumber });
  });

  it('publishes nothing for a rejected registration', async () => {
    const email = `jane-${randomUUID()}@example.com`;
    await register({ email, password: 'correct-horse' }).expect(201);
    const publish = vi.spyOn(app.get(KafkaProducerService), 'publish');

    await register({ email, password: 'correct-horse' }).expect(409);
    await register({ password: 'correct-horse' }).expect(400);

    expect(publish).not.toHaveBeenCalled();
  });

  it('still registers when publishing fails, and logs the failure', async () => {
    vi.spyOn(app.get(KafkaProducerService), 'publish').mockRejectedValueOnce(new Error('broker down'));
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const email = `jane-${randomUUID()}@example.com`;

    const response = await register({ email, password: 'correct-horse' }).expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(await dataSource.getRepository(Identity).countBy({ email })).toBe(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('failed to publish identity.registered'), expect.stringContaining('broker down'));
  });

  it('keeps identity.events forever so a new consumer group can replay the whole history', async () => {
    const client = await getContainerRuntimeClient();
    const container = client.container.getById(process.env.TEST_KAFKA_CONTAINER_ID as string);

    const { output, exitCode } = await client.container.exec(container, [
      '/opt/kafka/bin/kafka-configs.sh', '--bootstrap-server', 'localhost:29092', '--entity-type', 'topics', '--entity-name', TopicEnum.IDENTITY_EVENTS, '--describe',
    ]);

    expect(exitCode).toBe(0);
    expect(output).toContain('retention.ms=-1');
  });

  it('creates the identity.events topic with 3 partitions', async () => {
    const admin = kafka.admin();
    await admin.connect();

    try {
      const [topic] = await admin.fetchTopicMetadata({ topics: [TopicEnum.IDENTITY_EVENTS] });
      expect(topic.partitions).toHaveLength(3);
    } finally {
      await admin.disconnect();
    }
  });
});
