import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { IdentityRegisteredEvent, TopicEnum, UserCreatedEvent } from '@marketplace/messaging-contracts';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { User } from '../../src/user/entity/user.entity.js';
import { Account } from '../../src/account/entity/account.entity.js';
import { truncateAllTables } from '../support/isolation.js';

process.env.KAFKA_CONSUMERS_ENABLED = 'true';

interface ReceivedInterface {
  key: string | undefined;
  headers: Record<string, string | undefined>;
  value: string;
}

describe('Registration provisioning over Kafka (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kafka: KafkaJS.Kafka;
  let producer: KafkaJS.Producer;
  let userCreate: { execute: (input: { identityId: number; email: string | null; phoneNumber: string | null }) => Promise<void> };
  let userGateway: { handle: (event: unknown) => Promise<void> };
  const consumers: KafkaJS.Consumer[] = [];
  const identityEvents: ReceivedInterface[] = [];
  const userEvents: ReceivedInterface[] = [];
  const deadLetters: ReceivedInterface[] = [];

  async function clearTopic(admin: KafkaJS.Admin, topic: string): Promise<void> {
    const partitions = await admin.fetchTopicOffsets(topic);
    await admin.deleteTopicRecords({ topic, partitions: partitions.map(({ partition, high }) => ({ partition, offset: high })) });
  }

  async function collect(topic: string, into: ReceivedInterface[]): Promise<void> {
    const consumer = kafka.consumer({ kafkaJS: { groupId: `provisioning-test-${randomUUID()}`, fromBeginning: true } });
    await consumer.connect();
    await consumer.subscribe({ topic });
    await consumer.run({
      eachMessage: async ({ message }) => {
        into.push({
          key: message.key?.toString(),
          headers: Object.fromEntries(Object.entries(message.headers ?? {}).map(([name, value]) => [name, value?.toString()])),
          value: message.value?.toString() ?? '',
        });
      },
    });
    consumers.push(consumer);
  }

  beforeAll(async () => {
    kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: [process.env.KAFKA_BROKERS as string], logLevel: KafkaJS.logLevel.NOTHING } });
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    for (const topic of [TopicEnum.IDENTITY_EVENTS, TopicEnum.USER_EVENTS].filter((name) => topics.includes(name))) {
      await clearTopic(admin, topic);
    }
    await admin.disconnect();

    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../../src/app.module.js');
    const { UserCreateCommandHandler } = await import('../../src/user/command-handler/user-create.command-handler.js');
    const { UserIdentityEventsGateway } = await import('../../src/user/gateway/user-identity-events.gateway.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    userCreate = app.get(UserCreateCommandHandler);
    userGateway = app.get(UserIdentityEventsGateway) as unknown as { handle: (event: unknown) => Promise<void> };

    producer = kafka.producer();
    await producer.connect();
    await collect(TopicEnum.IDENTITY_EVENTS, identityEvents);
    await collect(TopicEnum.USER_EVENTS, userEvents);
    await collect('user.profile.dlt', deadLetters);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    for (const consumer of consumers) {
      await consumer.disconnect();
    }
    await producer.disconnect();
    await app.close();

    const admin = kafka.admin();
    await admin.connect();
    await clearTopic(admin, TopicEnum.IDENTITY_EVENTS);
    await clearTopic(admin, TopicEnum.USER_EVENTS);
    await admin.disconnect();
  });

  function waitFor<T>(find: () => T | undefined | Promise<T | undefined>, what: string): Promise<T> {
    return vi.waitFor(async () => {
      const found = await find();
      if (found === undefined || found === null) throw new Error(`still waiting for ${what}`);
      return found;
    }, { timeout: 20000, interval: 100 });
  }

  async function registerAndProvision(): Promise<{ identity: Identity; user: User; account: Account }> {
    const email = `jane-${randomUUID()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'correct-horse' }).expect(201);
    const identity = await dataSource.getRepository(Identity).findOneByOrFail({ email });
    const user = await waitFor(async () => (await dataSource.getRepository(User).findOneBy({ identityId: identity.id })) ?? undefined, 'the user');
    const account = await waitFor(async () => (await dataSource.getRepository(Account).findOneBy({ customerId: user.id })) ?? undefined, 'the account');
    return { identity, user, account };
  }

  function sendIdentityEvent(value: string, type = IdentityRegisteredEvent.TYPE): Promise<void> {
    return producer.send({
      topic: TopicEnum.IDENTITY_EVENTS,
      messages: [{ key: randomUUID(), value, headers: { 'content-type': 'application/cloudevents+json', ce_type: type } }],
    }).then(() => undefined);
  }

  it('creates the user and a zero-balance account after a registration', async () => {
    const { identity, user, account } = await registerAndProvision();

    expect(user).toMatchObject({ identityId: identity.id, email: identity.email, phoneNumber: null, firstName: null, lastName: null });
    expect(account.balance).toBe('0.00');

    const received = await waitFor(() => userEvents.find(({ key }) => key === user.publicId), 'user.created');
    expect(received.headers).toMatchObject({ 'content-type': 'application/cloudevents+json', ce_type: UserCreatedEvent.TYPE });
    expect(JSON.parse(received.value)).toEqual({
      specversion: '1.0',
      id: user.publicId,
      source: '/user-service',
      type: 'user.created',
      time: user.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: user.publicId,
      correlationid: user.publicId,
      data: {
        userId: user.id,
        userPublicId: user.publicId,
        identityId: identity.id,
        email: identity.email,
        phoneNumber: null,
        firstName: null,
        lastName: null,
        language: user.language,
        createdAt: user.createdAt.toISOString(),
      },
    });
  });

  it('copies the phone of an identity registered by phone into the user', async () => {
    const fullNumber = `+38050${String(Date.now()).slice(-7)}`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: { countryCode: 'UA', rawNumber: fullNumber, fullNumber, nationalNumber: `0${fullNumber.slice(4)}` }, password: 'correct-horse' })
      .expect(201);
    const identity = await dataSource.getRepository(Identity).findOneByOrFail({ loginPhone: { fullNumber } });

    const user = await waitFor(async () => (await dataSource.getRepository(User).findOneBy({ identityId: identity.id })) ?? undefined, 'the user');

    expect(user).toMatchObject({ email: null, phoneNumber: fullNumber });
    await waitFor(async () => (await dataSource.getRepository(Account).findOneBy({ customerId: user.id })) ?? undefined, 'the account');
  });

  it('creates one user and one account when identity.registered is delivered again', async () => {
    const { identity, user } = await registerAndProvision();
    const original = await waitFor(() => identityEvents.find(({ key }) => key === identity.publicId), 'identity.registered');
    const execute = vi.spyOn(userCreate, 'execute');

    await sendIdentityEvent(original.value);
    await sendIdentityEvent(original.value);

    await waitFor(() => (execute.mock.settledResults.filter(({ type }) => type === 'fulfilled').length >= 2 ? true : undefined), 'both redeliveries');
    expect(await dataSource.getRepository(User).countBy({ identityId: identity.id })).toBe(1);
    expect(await dataSource.getRepository(Account).countBy({ customerId: user.id })).toBe(1);
    await waitFor(() => (userEvents.filter(({ key }) => key === user.publicId).length >= 3 ? true : undefined), 'republished user.created');
    expect(new Set(userEvents.filter(({ key }) => key === user.publicId).map(({ value }) => JSON.parse(value).id))).toEqual(new Set([user.publicId]));
  });

  it('retries a transient failure until the user is created', async () => {
    vi.spyOn(userCreate, 'execute').mockRejectedValueOnce(new Error('database is restarting'));

    const { user, account } = await registerAndProvision();

    expect(account.customerId).toBe(user.id);
  });

  it.each([
    ['a payload that is not JSON', '{not json'],
    ['an identity.registered without identityId', JSON.stringify({ specversion: '1.0', id: randomUUID(), type: IdentityRegisteredEvent.TYPE, data: { identityPublicId: randomUUID() } })],
  ])('sends %s to user.profile.dlt and keeps consuming', async (_, value) => {
    await sendIdentityEvent(value);

    const deadLetter = await waitFor(() => deadLetters.find((letter) => letter.value === value), 'the dead letter');
    expect(deadLetter.headers.dlt_reason).toEqual(expect.any(String));
    expect(deadLetter.headers.dlt_source).toMatch(/^identity\.events\/\d+@\d+$/);
    expect(await dataSource.getRepository(User).count()).toBe(0);

    await registerAndProvision();
  });

  it('skips event types it does not handle', async () => {
    const handle = vi.spyOn(userGateway, 'handle');
    const value = JSON.stringify({ specversion: '1.0', id: randomUUID(), type: 'identity.email-changed', data: { identityId: 1 } });

    await sendIdentityEvent(value, 'identity.email-changed');

    await waitFor(() => (handle.mock.settledResults.some(({ type }) => type === 'fulfilled') ? true : undefined), 'the skipped event');
    expect(deadLetters.some((letter) => letter.value === value)).toBe(false);
    expect(await dataSource.getRepository(User).count()).toBe(0);
  });
});
