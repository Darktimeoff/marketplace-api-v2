import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import amqp from 'amqplib';
import pg from 'pg';
import { CLOUD_EVENT_CONTENT_TYPE, OrderPlacedEvent } from '@marketplace/messaging-contracts';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
loadEnv({ path: path.join(rootDir, '.env'), quiet: true });

const { EMAIL_ORDER_PLACED_QUEUE } = await import('../dist/email/constant/order-placed-queue.constant.js');
const { EMAIL_ORDER_PLACED_DLQ } = await import('../dist/email/constant/order-placed-dlq.constant.js');
const { ORDER_EMAIL_CONSUMER } = await import('../dist/email/constant/order-email-consumer.constant.js');

const WORK_QUEUE = EMAIL_ORDER_PLACED_QUEUE;
const DLQ = EMAIL_ORDER_PLACED_DLQ;
const DEATH_REASONS = ['rejected', 'expired', 'maxlen', 'delivery_limit'];
const EVENTS = 5;

const env = process.env;
const brokerHost = env.RABBITMQ_HOST ?? 'localhost';
const brokerUser = required('RABBITMQ_USER');
const brokerPassword = required('RABBITMQ_PASSWORD');
const brokerUrl = `amqp://${encodeURIComponent(brokerUser)}:${encodeURIComponent(brokerPassword)}@${brokerHost}:${env.RABBITMQ_PORT ?? 5672}`;
const managementUrl = `http://${brokerHost}:${env.RABBITMQ_UI_PORT ?? 15672}/api`;
const appPort = Number(env.DEMO_APP_PORT ?? 3109);

function required(name) {
  if (!env[name]) {
    console.error(`${name} is not set: run through "bash scripts/with-secrets.sh dev ..." or export it with SKIP_VAULT=1 (README, Grading).`);
    process.exit(2);
  }
  return env[name];
}

function print(values) {
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);
}

function check(failures, ok, message) {
  if (!ok) failures.push(message);
}

function finish(failures) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

async function waitFor(what, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function management(pathname) {
  const response = await fetch(`${managementUrl}${pathname}`, {
    headers: { authorization: `Basic ${Buffer.from(`${brokerUser}:${brokerPassword}`).toString('base64')}` },
  });
  if (!response.ok) throw new Error(`management API ${pathname}: HTTP ${response.status}`);
  return response.json();
}

async function connectDb() {
  const client = new pg.Client({
    host: required('DBHOST'),
    port: Number(required('DBPORT')),
    user: required('DBUSER'),
    password: required('DBPASSWORD'),
    database: required('DBNAME'),
  });
  await client.connect();
  return client;
}

async function countEffects(db, ids) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM "Inbox" WHERE "consumer" = $1 AND "messageId"::text = ANY($2)`, [ORDER_EMAIL_CONSUMER, ids]);
  return rows[0].n;
}

async function depth(channel, queue) {
  const { messageCount } = await channel.checkQueue(queue);
  return messageCount;
}

function startApp() {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: rootDir,
    env: { ...env, PORT: String(appPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const collect = (chunk) => {
    for (const line of chunk.toString().split('\n')) log.push(line.replace(/\x1b\[[0-9;]*m/g, ''));
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  const app = {
    count: (kind, ids) => log.filter((line) => ids.some((id) => line.includes(`${kind} id=${id}`))).length,
    async ready() {
      await waitFor('the app to start', async () => {
        if (child.exitCode !== null) throw new Error(`app exited with ${child.exitCode}:\n${log.slice(-30).join('\n')}`);
        return fetch(`http://127.0.0.1:${appPort}/health`).then((r) => r.ok, () => false);
      }, 60_000);
    },
    async stop() {
      if (child.exitCode === null) child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
      await exited;
      clearTimeout(timer);
    },
  };
  return app;
}

async function startAppAlone(channel) {
  const app = startApp();
  await app.ready();
  const { consumerCount } = await channel.checkQueue(WORK_QUEUE);
  if (consumerCount !== 1) {
    await app.stop();
    throw new Error(`"${WORK_QUEUE}" has ${consumerCount} consumers, expected only the demo app: stop the running API first`);
  }
  return app;
}

async function consumerPrefetch() {
  const consumers = await waitFor('the consumer to register', async () => {
    const list = await management('/consumers/%2F');
    return list.filter((c) => c.queue.name === WORK_QUEUE).length > 0 ? list : null;
  });
  return consumers.find((c) => c.queue.name === WORK_QUEUE).prefetch_count;
}

async function acksOnWorkQueue() {
  const queue = await management(`/queues/%2F/${encodeURIComponent(WORK_QUEUE)}`);
  return queue.message_stats?.ack ?? 0;
}

async function publishConfirmed(channel, body) {
  let returned = false;
  const onReturn = () => (returned = true);
  channel.on('return', onReturn);
  channel.publish(OrderPlacedEvent.TOPIC, OrderPlacedEvent.TYPE, Buffer.from(JSON.stringify(body)), {
    persistent: true,
    mandatory: true,
    contentType: CLOUD_EVENT_CONTENT_TYPE,
  });
  await channel.waitForConfirms();
  channel.off('return', onReturn);
  if (returned) throw new Error(`event ${body.id} was unroutable`);
}

function orderEvent(id) {
  const now = new Date().toISOString();
  return {
    specversion: '1.0',
    id,
    source: OrderPlacedEvent.SOURCE,
    type: OrderPlacedEvent.TYPE,
    time: now,
    datacontenttype: 'application/json',
    subject: id,
    correlationid: id,
    data: { id: 0, publicId: id, totalAmount: '0.00', discountAmount: '0.00', status: 'created', currency: 'UAH', createdAt: now, updatedAt: now },
  };
}

async function prepareBuyerAndOffer(db) {
  const { rows: [offer] } = await db.query(
    `SELECT id, price FROM "SellerOffer" WHERE "deletedAt" IS NULL ORDER BY id LIMIT 1`,
  );
  const { rows: [buyer] } = await db.query(`SELECT id FROM "User" WHERE "deletedAt" IS NULL ORDER BY id LIMIT 1`);
  if (!offer || !buyer) throw new Error('no seller offer or user found: run "npm run seed" first');

  await db.query(`UPDATE "SellerOffer" SET quantity = quantity + $2 WHERE id = $1`, [offer.id, EVENTS]);
  await db.query(
    `INSERT INTO "Transaction" ("userId", amount, status, type) VALUES ($1, $2, 'SUCCESS', 'DEPOSIT')`,
    [buyer.id, (Number(offer.price) * EVENTS).toFixed(2)],
  );
  return { offerId: offer.id, buyerId: buyer.id };
}

async function placeOrder({ offerId, buyerId }) {
  const response = await fetch(`http://127.0.0.1:${appPort}/order`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: {
        buyerId,
        fullName: 'Demo Buyer',
        phone: { countryCode: 'UA', rawNumber: '0501234567', fullNumber: '+380501234567', nationalNumber: '501234567' },
        deliveryAddress: { addressLine: 'Khreshchatyk 1', city: 'Kyiv' },
      },
      items: [{ offerId, quantity: 1 }],
      currency: 'UAH',
    }),
  });
  const body = await response.json();
  if (response.status !== 201) throw new Error(`POST /order → ${response.status}: ${JSON.stringify(body)}`);
  return body.publicId;
}

async function demoPublish({ db, channel }) {
  const app = await startAppAlone(channel);
  try {
    await channel.purgeQueue(WORK_QUEUE);
    await channel.purgeQueue(DLQ);
    const prefetch = await consumerPrefetch();
    const acksBefore = await acksOnWorkQueue();

    const target = await prepareBuyerAndOffer(db);
    const ids = [];
    for (let i = 0; i < EVENTS; i++) ids.push(await placeOrder(target));

    await waitFor('all events to be processed', () => app.count('applied', ids) + app.count('skipped', ids) >= EVENTS);
    await waitFor('the queue to drain', async () => (await depth(channel, WORK_QUEUE)) === 0);
    const acked = await waitFor('ack statistics', async () => {
      const delta = (await acksOnWorkQueue()) - acksBefore;
      return delta >= EVENTS ? delta : null;
    }, 20_000).catch(async () => (await acksOnWorkQueue()) - acksBefore);

    const result = {
      published: ids.length,
      delivered: app.count('delivered', ids),
      effect: await countEffects(db, ids),
      acked,
      work: await depth(channel, WORK_QUEUE),
      dlq: await depth(channel, DLQ),
      prefetch,
    };
    print(result);

    const failures = [];
    check(failures, result.published === EVENTS, `published=${result.published}, expected ${EVENTS}`);
    check(failures, result.delivered >= EVENTS, `delivered=${result.delivered} < ${EVENTS}`);
    check(failures, result.effect === EVENTS, `effect=${result.effect}, expected ${EVENTS}`);
    check(failures, result.acked === EVENTS, `acked=${result.acked}, expected ${EVENTS}`);
    check(failures, result.dlq === 0, `dlq=${result.dlq}, expected 0`);
    check(failures, result.prefetch >= 1 && result.prefetch <= 2000, `prefetch=${result.prefetch} outside 1..2000`);
    return failures;
  } finally {
    await app.stop();
  }
}

async function demoDlq({ db, channel }) {
  const app = await startAppAlone(channel);
  try {
    await channel.purgeQueue(WORK_QUEUE);
    await channel.purgeQueue(DLQ);

    const id = `poison-${randomUUID()}`;
    await publishConfirmed(channel, { ...orderEvent(id), data: null });

    await waitFor('the poison event to reach the DLQ', async () => (await depth(channel, DLQ)) === 1);
    const dead = await channel.get(DLQ, { noAck: false });
    const headers = dead.properties.headers ?? {};
    const reason = String(headers['x-first-death-reason'] ?? headers['x-death']?.[0]?.reason);
    channel.nack(dead, false, true);
    await waitFor('the dead letter to settle back', async () => (await depth(channel, DLQ)) === 1);

    const result = {
      rejected: app.count('rejected', [id]),
      work: await depth(channel, WORK_QUEUE),
      dlq: await depth(channel, DLQ),
      'dlq-reason': reason,
      effect: await countEffects(db, [id]),
    };
    print(result);

    const failures = [];
    check(failures, result.rejected >= 1, `rejected=${result.rejected}, the consumer never rejected the event`);
    check(failures, result.work === 0, `work=${result.work}, expected 0`);
    check(failures, result.dlq === 1, `dlq=${result.dlq}, expected 1`);
    check(failures, DEATH_REASONS.includes(reason), `dlq-reason=${reason} is not one of ${DEATH_REASONS.join('|')}`);
    check(failures, result.effect === 0, `effect=${result.effect}, a poison event must not apply the effect`);
    return failures;
  } finally {
    await app.stop();
  }
}

function startCrashingConsumer() {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'crash-consumer'], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const effectApplied = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      const match = /effect-applied id=(\S+)/.exec(chunk.toString());
      if (match) resolve(match[1]);
    });
    child.once('exit', (code) => reject(new Error(`crash consumer exited with ${code} before applying the effect`)));
  });
  return { child, exited, effectApplied };
}

async function crashConsumer() {
  const db = await connectDb();
  const connection = await amqp.connect(brokerUrl);
  const channel = await connection.createChannel();
  await channel.prefetch(1);
  await channel.consume(WORK_QUEUE, async (msg) => {
    const event = JSON.parse(msg.content.toString());
    await db.query(`INSERT INTO "Inbox" ("consumer", "messageId") VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ORDER_EMAIL_CONSUMER, event.id]);
    console.log(`effect-applied id=${event.id}`);
  }, { noAck: false });
}

async function demoDuplicate({ db, channel }) {
  const topology = await startAppAlone(channel);
  await channel.purgeQueue(WORK_QUEUE);
  await topology.stop();
  await waitFor('the demo app to detach', async () => (await channel.checkQueue(WORK_QUEUE)).consumerCount === 0);

  const id = randomUUID();
  await publishConfirmed(channel, orderEvent(id));

  const crasher = startCrashingConsumer();
  await crasher.effectApplied;
  crasher.child.kill('SIGKILL');
  await crasher.exited;
  await waitFor('the broker to requeue the unacked delivery', async () => (await depth(channel, WORK_QUEUE)) === 1);

  const app = await startAppAlone(channel);
  try {
    await waitFor('the redelivery to be handled', () => app.count('skipped', [id]) + app.count('applied', [id]) >= 1);
    await waitFor('the queue to drain', async () => (await depth(channel, WORK_QUEUE)) === 0);

    const result = {
      deliveries: 1 + app.count('delivered', [id]),
      effect: await countEffects(db, [id]),
      skipped: app.count('skipped', [id]),
      work: await depth(channel, WORK_QUEUE),
    };
    print(result);

    const failures = [];
    check(failures, result.deliveries >= 2, `deliveries=${result.deliveries}, the event was never redelivered`);
    check(failures, result.effect === 1, `effect=${result.effect}, expected exactly 1`);
    check(failures, result.skipped >= 1, `skipped=${result.skipped}, the redelivery was not recognised as a duplicate`);
    check(failures, result.work === 0, `work=${result.work}, expected 0`);
    return failures;
  } finally {
    await app.stop();
  }
}

const demos = { publish: demoPublish, dlq: demoDlq, duplicate: demoDuplicate };
const mode = process.argv[2];

if (mode === 'crash-consumer') {
  await crashConsumer();
} else if (demos[mode]) {
  const db = await connectDb();
  const connection = await amqp.connect(brokerUrl);
  const channel = await connection.createConfirmChannel();
  try {
    finish(await demos[mode]({ db, channel }));
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await connection.close().catch(() => {});
    await db.end();
  }
} else {
  console.error(`usage: node scripts/rabbitmq-demo.mjs <${Object.keys(demos).join('|')}>`);
  process.exit(2);
}
