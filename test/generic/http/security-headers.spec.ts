import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SECURITY_HEADERS } from '../../../src/generic/http/constant/security-headers.constant.js';

@Controller()
class OrderController {
  @Get('order')
  order(): { id: string } {
    return { id: '9e6aba21' };
  }
}

describe('SECURITY_HEADERS with app.useSecurityHeaders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [OrderController] }).compile();
    app = moduleRef.createNestApplication();
    app.useSecurityHeaders(SECURITY_HEADERS);
    await app.init();
  });

  afterAll(() => app.close());

  it('sends the headers a JSON API needs on a matched route, and hides that it runs on Express', async () => {
    const response = await request(app.getHttpServer()).get('/order');

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none'");
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('leaves Strict-Transport-Security to the gateway, which terminates TLS', async () => {
    const response = await request(app.getHttpServer()).get('/order');

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });
});
