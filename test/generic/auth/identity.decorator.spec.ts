import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { Controller, Get, InternalServerErrorException, UseGuards, type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { Test } from '@nestjs/testing';
import { importPKCS8, SignJWT } from 'jose';
import request from 'supertest';
import { AccessTokenGuard } from '../../../src/generic/auth/access-token.guard.js';
import { AccessTokenVerifierService } from '../../../src/generic/auth/access-token-verifier.service.js';
import { SecretManagerService } from '../../../src/generic/secret-manager/secret-manager.service.js';
import { Identity } from '../../../src/generic/auth/decorator/identity.decorator.js';
import { RoleEnum } from '../../../src/identity/enum/role.enum.js';
import type { AccessTokenClaimsInterface } from '../../../src/generic/auth/interface/access-token-claims.interface.js';

type FactoryType = (field: unknown, context: ExecutionContext) => unknown;

function factoryOf(decorator: ParameterDecorator): FactoryType {
  class Target {
    handle(_value: unknown): void {}
  }
  decorator(Target.prototype, 'handle', 0);
  const metadata: Record<string, { factory: FactoryType }> = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handle');
  return Object.values(metadata)[0].factory;
}

function contextWith(identity: AccessTokenClaimsInterface | undefined): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers: {}, identity }) }) } as unknown as ExecutionContext;
}

describe('@Identity()', () => {
  const claims: AccessTokenClaimsInterface = {
    identityId: 42,
    role: RoleEnum.user,
    email: 'jane@example.com',
    phoneNumber: '+380501234567',
  };

  it('returns all claims when no field is given', () => {
    expect(factoryOf(Identity())(undefined, contextWith(claims))).toEqual(claims);
  });

  it('returns a single claim when a field is given', () => {
    expect(factoryOf(Identity('identityId'))('identityId', contextWith(claims))).toBe(42);
  });

  it('fails loudly when the guard did not run', () => {
    expect(() => factoryOf(Identity())(undefined, contextWith(undefined))).toThrow(InternalServerErrorException);
  });
});

describe('@Identity() on a guarded route', () => {
  it('receives the verified claims over HTTP', async () => {
    const keys = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    @Controller('me')
    class MeController {
      @UseGuards(AccessTokenGuard)
      @Get()
      me(@Identity() identity: AccessTokenClaimsInterface, @Identity('identityId') identityId: number) {
        return { identity, identityId };
      }
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        AccessTokenGuard,
        AccessTokenVerifierService,
        { provide: SecretManagerService, useValue: { get: async () => keys.publicKey } },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const token = await new SignJWT({ role: 'user', email: 'jane@example.com' })
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('42')
      .setIssuer('identity-service')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(await importPKCS8(keys.privateKey, 'ES256'));

    try {
      const response = await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(response.body).toEqual({
        identity: { identityId: 42, role: 'user', email: 'jane@example.com', phoneNumber: null },
        identityId: 42,
      });

      await request(app.getHttpServer()).get('/me').expect(401);
    } finally {
      await app.close();
    }
  });
});
