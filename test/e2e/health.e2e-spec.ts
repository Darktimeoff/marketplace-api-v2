import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, get as httpGet, type IncomingHttpHeaders } from 'node:http';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { truncateAllTables } from '../support/isolation.js';

describe('Health and graceful shutdown (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const credentials = { email: 'drain@example.com', password: 'correct-horse' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app.getHttpServer().listening) {
      await app.close();
    }
  });

  function get(path: string) {
    return fetch(`${baseUrl}${path}`);
  }

  function headersOf(path: string, agent: Agent) {
    return new Promise<IncomingHttpHeaders>((resolve, reject) => {
      httpGet(`${baseUrl}${path}`, { agent }, (response) => {
        response.resume();
        response.on('end', () => resolve(response.headers));
      }).on('error', reject);
    });
  }

  function login() {
    return fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: credentials.email, password: credentials.password }),
    });
  }

  it('answers liveness and readiness with the database and shutdown checks', async () => {
    const live = await get('/healthz');
    const ready = await get('/readyz');

    expect(live.status).toBe(200);
    expect(await live.json()).toMatchObject({ status: 'ok' });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({
      status: 'ok',
      details: { shutdown: { status: 'up' }, database: { status: 'up' } },
    });
  });

  it('turns readiness red during the drain while every dependency still serves, then closes the socket', async () => {
    await truncateAllTables(app.get(DataSource));
    const register = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    expect(register.status).toBe(201);

    const agent = new Agent({ keepAlive: true });
    expect((await headersOf('/healthz', agent)).connection).toBe('keep-alive');

    const closed = app.close();

    await expect.poll(async () => (await get('/readyz')).status, { timeout: 5000, interval: 20 }).toBe(503);

    const ready = await get('/readyz');
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ error: { shutdown: { status: 'down', reason: 'draining' } } });
    expect((await get('/healthz')).status).toBe(200);
    expect((await login()).status).toBe(200);
    expect((await headersOf('/healthz', agent)).connection).toBe('close');
    agent.destroy();

    await closed;

    await expect(get('/healthz')).rejects.toThrow();
  });
});
