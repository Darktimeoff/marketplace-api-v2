import { beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync, createSecretKey } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { importPKCS8, SignJWT, type CryptoKey } from 'jose';
import { AccessTokenGuard } from '../../../src/generic/auth/access-token.guard.js';
import { AccessTokenVerifierService } from '../../../src/generic/auth/access-token-verifier.service.js';
import type { SecretManagerService } from '../../../src/generic/secret-manager/secret-manager.service.js';
import type { AuthenticatedRequestInterface } from '../../../src/generic/auth/interface/authenticated-request.interface.js';

function aKeyPair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

function contextFor(request: AuthenticatedRequestInterface): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('AccessTokenGuard', () => {
  const keys = aKeyPair();
  let signingKey: CryptoKey;
  let guard: AccessTokenGuard;

  beforeAll(async () => {
    const secrets = { get: async () => keys.publicKey } as unknown as SecretManagerService;
    const verifier = new AccessTokenVerifierService(secrets);
    await verifier.onModuleInit();
    guard = new AccessTokenGuard(verifier);
    signingKey = await importPKCS8(keys.privateKey, 'ES256');
  });

  function aToken(overrides: { issuer?: string; expiresAt?: number | string; key?: CryptoKey; claims?: Record<string, unknown> } = {}) {
    return new SignJWT({ role: 'user', email: 'jane@example.com', phone_number: '+380501234567', ...overrides.claims })
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('42')
      .setIssuer(overrides.issuer ?? 'identity-service')
      .setIssuedAt()
      .setExpirationTime(overrides.expiresAt ?? '15m')
      .sign(overrides.key ?? signingKey);
  }

  async function activate(authorization: string | undefined): Promise<AuthenticatedRequestInterface> {
    const request: AuthenticatedRequestInterface = { headers: { authorization } };
    await guard.canActivate(contextFor(request));
    return request;
  }

  it('accepts a valid token and exposes the claims on the request', async () => {
    const request = await activate(`Bearer ${await aToken()}`);

    expect(request.identity).toEqual({ identityId: 42, role: 'user', email: 'jane@example.com', phoneNumber: '+380501234567' });
  });

  it('exposes null for missing email and phone claims', async () => {
    const request = await activate(`Bearer ${await aToken({ claims: { email: undefined, phone_number: undefined } })}`);

    expect(request.identity).toMatchObject({ email: null, phoneNumber: null });
  });

  it.each([
    ['no header', undefined],
    ['another scheme', 'Basic abc'],
    ['bearer without a token', 'Bearer'],
    ['extra parts', 'Bearer a b'],
    ['garbage', 'Bearer not-a-jwt'],
  ])('rejects %s', async (_, authorization) => {
    await expect(activate(authorization)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const token = await aToken({ expiresAt: Math.floor(Date.now() / 1000) - 60 });

    await expect(activate(`Bearer ${token}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token from another issuer', async () => {
    await expect(activate(`Bearer ${await aToken({ issuer: 'someone-else' })}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token signed with another key', async () => {
    const otherKey = await importPKCS8(aKeyPair().privateKey, 'ES256');

    await expect(activate(`Bearer ${await aToken({ key: otherKey })}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown role', async () => {
    await expect(activate(`Bearer ${await aToken({ claims: { role: 'root' } })}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects alg none', async () => {
    const payload = { sub: '42', role: 'user', iss: 'identity-service', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 };
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.`;

    await expect(activate(`Bearer ${token}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an HS256 token signed with the public key as the secret', async () => {
    const token = await new SignJWT({ role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('42')
      .setIssuer('identity-service')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(createSecretKey(Buffer.from(keys.publicKey)));

    await expect(activate(`Bearer ${token}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
