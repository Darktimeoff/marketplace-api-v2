// TODO(hw-29): remove after homework
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';

export function build() {
  execFileSync('npm', ['run', 'build'], { stdio: ['ignore', 'ignore', 'inherit'] });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function startApp(logFile, extraEnv = {}) {
  const port = await freePort();
  const metricsPort = Number(process.env.METRICS_PORT || 9464);
  const output = createWriteStream(logFile);
  const errors = createWriteStream(`${logFile}.stderr`);
  const child = spawn(process.execPath, ['--import', './dist/telemetry.js', 'dist/main.js'], {
    env: { ...process.env, PORT: String(port), METRICS_PORT: String(metricsPort), DEMO_FAULTS: '1', LOG_LEVEL: 'info', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(output);
  child.stderr.pipe(errors);
  const url = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`the app exited with code ${child.exitCode} before it was ready`);
    }

    const ready = await fetch(`${url}/readyz`).then((response) => response.ok, () => false);

    if (ready) {
      return { url, metricsUrl: `http://127.0.0.1:${metricsPort}/metrics`, child, output, errors, logFile };
    }

    await sleep(500);
  }

  child.kill('SIGTERM');
  throw new Error('the app was not ready in 60 s');
}

export async function stopApp(app) {
  if (app.child.exitCode === null) {
    const exited = new Promise((resolve) => app.child.once('exit', resolve));
    app.child.kill('SIGTERM');
    await exited;
  }

  await new Promise((resolve) => app.output.end(resolve));
  await new Promise((resolve) => app.errors.end(resolve));
}

export function logLines(app) {
  return readFileSync(app.logFile, 'utf8').split('\n').filter((line) => line.length > 0);
}

export function newTraceparent() {
  const traceId = randomBytes(16).toString('hex');
  return { traceId, header: `00-${traceId}-${randomBytes(8).toString('hex')}-01` };
}

export async function stockedOffer() {
  const client = new pg.Client({
    host: process.env.DBHOST,
    port: Number(process.env.DBPORT),
    user: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    database: process.env.DBNAME,
  });
  await client.connect();

  try {
    const { rows } = await client.query('SELECT "publicId", "currency" FROM "SellerOffer" ORDER BY "onHandQuantity" DESC LIMIT 1');

    if (rows.length === 0) {
      throw new Error('no seller offer found: run npm run seed');
    }

    return { offerPublicId: rows[0].publicId, currency: rows[0].currency };
  } finally {
    await client.end();
  }
}

export function orderBody(offer) {
  return JSON.stringify({
    currency: offer.currency,
    items: [{ offerPublicId: offer.offerPublicId, quantity: 1 }],
    recipient: {
      fullName: 'Demo Buyer',
      phone: { countryCode: 'UA', rawNumber: '0501234567', fullNumber: '+380501234567', nationalNumber: '501234567' },
      address: { addressLine: 'Khreshchatyk 1', city: 'Kyiv' },
    },
  });
}

export function placeOrder(app, token, offer, headers = {}) {
  return fetch(`${app.url}/order`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), ...headers },
    body: orderBody(offer),
  });
}

export async function buyer(app, offer) {
  const email = `demo-${randomBytes(6).toString('hex')}@example.com`;
  const password = `demo-${randomBytes(12).toString('hex')}`;
  const json = { 'content-type': 'application/json' };

  await fetch(`${app.url}/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });
  const { accessToken } = await (await fetch(`${app.url}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ login: email, password }) })).json();

  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await placeOrder(app, accessToken, offer);
    await response.arrayBuffer();

    if (response.status === 202) {
      return accessToken;
    }

    if (response.status !== 409) {
      throw new Error(`placing the first order answered ${response.status}`);
    }

    await sleep(500);
  }

  throw new Error('the buyer was not set up in 30 s');
}

export function report(values, invariants) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }

  const broken = invariants.filter(([, holds]) => !holds).map(([name]) => name);

  if (broken.length > 0) {
    console.error(`broken: ${broken.join(', ')}`);
    process.exitCode = 1;
  }
}
