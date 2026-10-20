import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { calculateJwkThumbprint, exportJWK, importPKCS8, SignJWT } from 'jose';
import { AccessTokenVerifierService } from '../../../src/generic/auth/access-token-verifier.service.js';
import { JwtVerificationKeysService } from '../../../src/generic/auth/jwt-verification-keys.service.js';
import { TokenService } from '../../../src/identity/service/token.service.js';
import type { SecretManagerService } from '../../../src/generic/secret-manager/secret-manager.service.js';
import type { AccessTokenDenylistService } from '../../../src/generic/auth/access-token-denylist.service.js';
import type { IdentitySessionRepository } from '../../../src/identity/repository/identity-session.repository.js';
import type { Identity } from '../../../src/identity/entity/identity.entity.js';

function aKeyPair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

describe('JWT key rotation without downtime', () => {
  const k1 = aKeyPair();
  const k2 = aKeyPair();
  const vault: Record<string, string> = {};
  const secrets = { get: async (name: string) => vault[name] } as unknown as SecretManagerService;
  const denylist = { isFamilyDenied: async () => false } as unknown as AccessTokenDenylistService;
  const identity = { id: 1, publicId: randomUUID(), role: 'user', email: 'jane@example.com', loginPhone: { fullNumber: null } } as unknown as Identity;
  let keys: JwtVerificationKeysService;
  let verifier: AccessTokenVerifierService;
  let tokens: TokenService;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vault.JWT_PUBLIC_KEY = k1.publicKey;
    vault.JWT_PRIVATE_KEY = k1.privateKey;
    vault.REFRESH_TOKEN_PEPPER = 'test-pepper';
    keys = new JwtVerificationKeysService(secrets);
    await keys.onModuleInit();
    verifier = new AccessTokenVerifierService(keys, denylist);
    tokens = new TokenService(secrets, { create: async () => undefined } as unknown as IdentitySessionRepository, keys);
    await tokens.onModuleInit();
  });

  async function kidOf(privateKeyPem: string): Promise<string> {
    return calculateJwkThumbprint(await exportJWK(await importPKCS8(privateKeyPem, 'ES256', { extractable: true })));
  }

  async function issue(): Promise<string> {
    return (await tokens.createTokenPair(identity)).accessToken;
  }

  it('walks k1 → k1+k2 → sign k2 → k2 while tokens of both keys keep working', async () => {
    const signedByK1 = await issue();

    vault.JWT_PUBLIC_KEY = `${k1.publicKey}${k2.publicKey}`;
    await keys.refresh();
    expect(keys.kids).toEqual([await kidOf(k1.privateKey), await kidOf(k2.privateKey)]);
    await expect(verifier.verify(signedByK1)).resolves.toBeDefined();

    vault.JWT_PRIVATE_KEY = k2.privateKey;
    await tokens.refreshSigningKey();
    const signedByK2 = await issue();
    await expect(verifier.verify(signedByK1)).resolves.toBeDefined();
    await expect(verifier.verify(signedByK2)).resolves.toBeDefined();

    vault.JWT_PUBLIC_KEY = k2.publicKey;
    await keys.refresh();
    await expect(verifier.verify(signedByK2)).resolves.toBeDefined();
    await expect(verifier.verify(signedByK1)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('writes the signing kid into the token header', async () => {
    const token = await issue();
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());

    expect(header.kid).toBe(await kidOf(k1.privateKey));
  });

  it('rejects a token whose kid is not a verification key', async () => {
    const token = await new SignJWT({ role: 'user', jti: randomUUID(), sid: randomUUID() })
      .setProtectedHeader({ alg: 'ES256', kid: 'unknown' })
      .setSubject(identity.publicId)
      .setIssuer('identity-service')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(await importPKCS8(k1.privateKey, 'ES256'));

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('warns when signing switches to a key the pod cannot verify yet', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    vault.JWT_PRIVATE_KEY = k2.privateKey;
    await tokens.refreshSigningKey();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`kid=${await kidOf(k2.privateKey)} is not among this pod's verification keys`));
  });

  it('keeps the current keys when the vault cannot be read', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const before = await issue();
    vault.JWT_PUBLIC_KEY = 'not a pem';

    await keys.refresh();

    expect(error).toHaveBeenCalled();
    await expect(verifier.verify(before)).resolves.toBeDefined();
  });

  it('logs the key set once per change, so every pod reports when it has the new key', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await keys.refresh();
    vault.JWT_PUBLIC_KEY = `${k1.publicKey}${k2.publicKey}`;
    await keys.refresh();
    await keys.refresh();

    expect(log.mock.calls.filter(([message]) => String(message).startsWith('jwt verification keys:'))).toHaveLength(1);
  });
});
