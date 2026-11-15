import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request } from 'express';
import { ProxyTrustService } from '../../../src/generic/http/proxy-trust.service.js';
import { EnvironmentService } from '../../../src/generic/environment/environment.module.js';

@Controller()
class EchoController {
  @Get('echo')
  echo(@Req() req: Request): { ip: string | undefined; protocol: string } {
    return { ip: req.ip, protocol: req.protocol };
  }
}

describe('ProxyTrustService', () => {
  let app: INestApplication;

  afterEach(() => app?.close());

  async function appTrusting(hops: number): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      controllers: [EchoController],
      providers: [ProxyTrustService, { provide: EnvironmentService, useValue: { get: () => hops } }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return app;
  }

  it('takes the address the one trusted proxy appended, so a client cannot choose its own by sending X-Forwarded-For', async () => {
    const response = await request((await appTrusting(1)).getHttpServer())
      .get('/echo')
      .set('x-forwarded-for', '6.6.6.6, 203.0.113.7')
      .set('x-forwarded-proto', 'https');

    expect(response.body).toEqual({ ip: '203.0.113.7', protocol: 'https' });
  });

  it('ignores forwarded headers when no proxy is trusted, as when the app is reached directly', async () => {
    const response = await request((await appTrusting(0)).getHttpServer())
      .get('/echo')
      .set('x-forwarded-for', '6.6.6.6')
      .set('x-forwarded-proto', 'https');

    expect(response.body.ip).toMatch(/127\.0\.0\.1$/);
    expect(response.body.protocol).toBe('http');
  });
});
