// TODO(hw-24): remove after homework, shared harness of the auth demo scripts
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';

export interface DemoResponseInterface {
  status: number;
  body: Record<string, unknown>;
}

export class DemoClient {
  private constructor(
    readonly app: INestApplication,
    private readonly url: string,
  ) {}

  static async start(): Promise<DemoClient> {
    const app = await NestFactory.create(AppModule, { logger: ['error'] });
    await app.listen(0, '127.0.0.1');
    return new DemoClient(app, await app.getUrl());
  }

  async call(method: string, path: string, options: { token?: string; body?: object } = {}): Promise<DemoResponseInterface> {
    const response = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.token && { authorization: `Bearer ${options.token}` }),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : {} };
  }

  async register(): Promise<{ email: string; accessToken: string; refreshToken: string }> {
    const email = `demo-${randomUUID()}@example.com`;
    const registered = await this.call('POST', '/auth/register', { body: { email, password: 'demo-password-1' } });

    if (registered.status !== 201) {
      throw new Error(`register failed with ${registered.status}`);
    }

    return { email, accessToken: String(registered.body.accessToken), refreshToken: String(registered.body.refreshToken) };
  }

  async stop(): Promise<void> {
    await Promise.race([this.app.close(), new Promise((resolve) => setTimeout(resolve, 10000))]);
  }
}

export function report(values: Record<string, number>, invariants: [string, boolean][]): number {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }

  const broken = invariants.filter(([, ok]) => !ok).map(([name]) => name);
  console.log(broken.length === 0 ? 'invariant=ok' : `invariant=broken: ${broken.join(', ')}`);
  return broken.length === 0 ? 0 : 1;
}

export async function run(scenario: (client: DemoClient) => Promise<number>): Promise<void> {
  let code = 2;
  let client: DemoClient | undefined;

  try {
    client = await DemoClient.start();
    code = await scenario(client);
  } catch (error) {
    console.error(error);
  } finally {
    await client?.stop();
    process.exit(code);
  }
}
