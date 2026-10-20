import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import { AppModule } from '../../src/app.module.js';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { IdentitySession } from '../../src/identity/entity/identity-session.entity.js';
import { CountryCodeEnum } from '@marketplace/contracts-core';
import { truncateAllTables } from '../support/isolation.js';
import { AccessTokenVerifierService } from '../../src/generic/auth/access-token-verifier.service.js';
import { RedisClientService } from '../../src/generic/redis/redis-client.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const phone = {
    countryCode: CountryCodeEnum.UA,
    rawNumber: '+380501234567',
    fullNumber: '+380501234567',
    nationalNumber: '0501234567',
  };

  function post(path: string, body: object) {
    return request(app.getHttpServer()).post(`/auth/${path}`).send(body);
  }

  async function register(body: object = { email: 'jane@example.com', password: 'correct-horse' }) {
    return (await post('register', body).expect(201)).body as { accessToken: string; refreshToken: string };
  }

  async function claimsOf(accessToken: string) {
    const publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY as string, 'ES256');
    const { payload } = await jwtVerify(accessToken, publicKey, { issuer: 'identity-service', algorithms: ['ES256'] });
    return payload;
  }

  describe('register', () => {
    it('registers by email and returns a signed token pair', async () => {
      const response = await post('register', { email: 'jane@example.com', password: 'correct-horse' }).expect(201);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      expect(decodeProtectedHeader(response.body.accessToken)).toMatchObject({ alg: 'ES256', kid: expect.any(String) });

      const identity = await dataSource.getRepository(Identity).findOneByOrFail({ email: 'jane@example.com' });
      const claims = await claimsOf(response.body.accessToken);
      expect(claims).toMatchObject({ sub: identity.publicId, role: 'user', email: 'jane@example.com' });
      expect(claims.phone_number).toBeUndefined();
      expect((claims.exp as number) - (claims.iat as number)).toBe(900);
      expect(identity.passwordHash).toMatch(/^\$argon2id\$/);
      expect(identity.activatedAt).toBeNull();
    });

    it('registers by phone', async () => {
      const { accessToken } = await register({ phone, password: 'correct-horse' });

      const identity = await dataSource.getRepository(Identity).findOneByOrFail({ loginPhone: { fullNumber: phone.fullNumber } });
      expect(identity.email).toBeNull();
      expect(identity.loginPhone).toEqual(phone);
      const claims = await claimsOf(accessToken);
      expect(claims).toMatchObject({ sub: identity.publicId, phone_number: phone.fullNumber });
      expect(claims.email).toBeUndefined();
    });

    it('registers by email and phone together', async () => {
      const { accessToken } = await register({ email: 'jane@example.com', phone, password: 'correct-horse' });

      expect(await claimsOf(accessToken)).toMatchObject({ email: 'jane@example.com', phone_number: phone.fullNumber });
    });

    it('ignores a role in the body', async () => {
      const { accessToken } = await register({ email: 'jane@example.com', password: 'correct-horse', role: 'admin' });

      expect((await claimsOf(accessToken)).role).toBe('user');
    });

    it('rejects a duplicate email regardless of case with 409', async () => {
      await register({ email: 'jane@example.com', password: 'correct-horse' });

      await post('register', { email: 'JANE@example.com', password: 'correct-horse' }).expect(409);
      expect(await dataSource.getRepository(Identity).count()).toBe(1);
    });

    it('rejects a duplicate phone with 409', async () => {
      await register({ phone, password: 'correct-horse' });

      await post('register', { phone, password: 'correct-horse' }).expect(409);
      expect(await dataSource.getRepository(Identity).count()).toBe(1);
    });

    it('lets only one of two concurrent registrations with the same email succeed', async () => {
      const body = { email: 'jane@example.com', password: 'correct-horse' };

      const responses = await Promise.all([post('register', body), post('register', body)]);

      expect(responses.map((response) => response.status).toSorted()).toEqual([201, 409]);
    });

    it.each([
      ['neither email nor phone', { password: 'correct-horse' }],
      ['an invalid email', { email: 'not-an-email', password: 'correct-horse' }],
      ['a phone not in E.164', { phone: { ...phone, fullNumber: '0501234567' }, password: 'correct-horse' }],
      ['an unknown country code', { phone: { ...phone, countryCode: 'XX' }, password: 'correct-horse' }],
      ['a 7-character password', { email: 'jane@example.com', password: 'x'.repeat(7) }],
      ['a 129-character password', { email: 'jane@example.com', password: 'x'.repeat(129) }],
      ['no password', { email: 'jane@example.com' }],
    ])('rejects %s with 400', async (_, body) => {
      await post('register', body).expect(400);
      expect(await dataSource.getRepository(Identity).count()).toBe(0);
    });
  });

  describe('login', () => {
    it('logs in by email in any case', async () => {
      await register({ email: 'jane@example.com', password: 'correct-horse' });

      const response = await post('login', { login: 'Jane@Example.com', password: 'correct-horse' }).expect(200);

      expect((await claimsOf(response.body.accessToken)).email).toBe('jane@example.com');
    });

    it('logs in by phone', async () => {
      await register({ phone, password: 'correct-horse' });

      const response = await post('login', { login: phone.fullNumber, password: 'correct-horse' }).expect(200);

      expect((await claimsOf(response.body.accessToken)).phone_number).toBe(phone.fullNumber);
    });

    it('starts a new session on every login', async () => {
      await register({ email: 'jane@example.com', password: 'correct-horse' });

      await post('login', { login: 'jane@example.com', password: 'correct-horse' }).expect(200);

      const families = new Set((await dataSource.getRepository(IdentitySession).find()).map((session) => session.familyId));
      expect(families.size).toBe(2);
    });

    it('answers a wrong password and an unknown login the same way', async () => {
      await register({ email: 'jane@example.com', password: 'correct-horse' });

      const wrongPassword = await post('login', { login: 'jane@example.com', password: 'wrong-horse' }).expect(401);
      const unknownLogin = await post('login', { login: 'nobody@example.com', password: 'correct-horse' }).expect(401);
      const unknownPhone = await post('login', { login: '+380509999999', password: 'correct-horse' }).expect(401);

      expect(wrongPassword.body).toEqual(unknownLogin.body);
      expect(unknownPhone.body).toEqual(unknownLogin.body);
      expect(wrongPassword.body.message).toBe('Invalid login or password');
    });

    it('refuses a soft-deleted identity', async () => {
      await register({ email: 'jane@example.com', password: 'correct-horse' });
      await dataSource.getRepository(Identity).softDelete({ email: 'jane@example.com' });

      await post('login', { login: 'jane@example.com', password: 'correct-horse' }).expect(401);
    });

    it('rejects a body without a password with 400', async () => {
      await post('login', { login: 'jane@example.com' }).expect(400);
    });
  });

  describe('refresh', () => {
    it('rotates the pair and keeps the session family', async () => {
      const first = await register();

      const response = await post('refresh', { refreshToken: first.refreshToken }).expect(200);

      expect(response.body.refreshToken).not.toBe(first.refreshToken);
      expect((await claimsOf(response.body.accessToken)).email).toBe('jane@example.com');
      const sessions = await dataSource.getRepository(IdentitySession).find({ order: { id: 'ASC' } });
      expect(sessions).toHaveLength(2);
      expect(sessions[1].familyId).toBe(sessions[0].familyId);
      expect(sessions[0].usedAt).not.toBeNull();
      expect(sessions[1].usedAt).toBeNull();
    });

    it('stores only a hash of the refresh token', async () => {
      const { refreshToken } = await register();

      const [session] = await dataSource.getRepository(IdentitySession).find();
      expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(session.tokenHash).not.toContain(refreshToken);
      expect(session.tokenHash).toBe(createHmac('sha256', process.env.REFRESH_TOKEN_PEPPER as string).update(refreshToken).digest('hex'));
      expect(session.tokenHash).not.toBe(createHash('sha256').update(refreshToken).digest('hex'));
    });

    it('logs the reuse with the revoked family', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const first = await register();
      await post('refresh', { refreshToken: first.refreshToken }).expect(200);
      const [session] = await dataSource.query(`SELECT "familyId" FROM "IdentitySession" LIMIT 1`);

      await post('refresh', { refreshToken: first.refreshToken }).expect(401);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`refresh token reuse detected: revoking family=${session.familyId}`));
      warn.mockRestore();
    });

    it('revokes the whole family when a used token is presented again', async () => {
      const first = await register();
      const second = (await post('refresh', { refreshToken: first.refreshToken }).expect(200)).body;

      await post('refresh', { refreshToken: first.refreshToken }).expect(401);

      await post('refresh', { refreshToken: second.refreshToken }).expect(401);
      const sessions = await dataSource.getRepository(IdentitySession).find();
      expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    });

    it('does not touch other sessions of the same identity on reuse', async () => {
      const first = await register();
      const other = (await post('login', { login: 'jane@example.com', password: 'correct-horse' }).expect(200)).body;
      await post('refresh', { refreshToken: first.refreshToken }).expect(200);

      await post('refresh', { refreshToken: first.refreshToken }).expect(401);

      await post('refresh', { refreshToken: other.refreshToken }).expect(200);
    });

    it('lets only one of two concurrent refreshes of the same token succeed', async () => {
      const { refreshToken } = await register();

      const responses = await Promise.all([post('refresh', { refreshToken }), post('refresh', { refreshToken })]);

      expect(responses.map((response) => response.status).toSorted()).toEqual([200, 401]);
    });

    it('rejects an expired token', async () => {
      const { refreshToken } = await register();
      await dataSource.query(`UPDATE "IdentitySession" SET "createdAt" = now() - interval '31 days', "expiresAt" = now() - interval '1 day'`);

      await post('refresh', { refreshToken }).expect(401);
    });

    it('rejects an unknown token', async () => {
      await post('refresh', { refreshToken: 'A'.repeat(43) }).expect(401);
    });

    it('rejects a malformed token with 400', async () => {
      await post('refresh', { refreshToken: 'short' }).expect(400);
    });

    it('refuses to refresh for a soft-deleted identity', async () => {
      const { refreshToken } = await register();
      await dataSource.getRepository(Identity).softDelete({ email: 'jane@example.com' });

      await post('refresh', { refreshToken }).expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the session so its refresh token stops working', async () => {
      const first = await register();
      const second = (await post('refresh', { refreshToken: first.refreshToken }).expect(200)).body;

      await post('logout', { refreshToken: second.refreshToken }).expect(204);

      await post('refresh', { refreshToken: second.refreshToken }).expect(401);
    });

    it('revokes a refresh token issued by a rotation that commits while the logout runs', async () => {
      const { refreshToken } = await register();
      const hash = (token: string) => createHmac('sha256', process.env.REFRESH_TOKEN_PEPPER as string).update(token).digest('hex');
      const [presented] = await dataSource.query(`SELECT "identityId", "familyId" FROM "IdentitySession" WHERE "tokenHash" = $1`, [hash(refreshToken)]);
      const rotatedToken = randomBytes(32).toString('base64url');
      const rotation = dataSource.createQueryRunner();
      await rotation.connect();
      await rotation.startTransaction();

      try {
        await rotation.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`identity-session-family:${presented.familyId}`]);
        await rotation.query(`UPDATE "IdentitySession" SET "usedAt" = now() WHERE "tokenHash" = $1`, [hash(refreshToken)]);
        await rotation.query(
          `INSERT INTO "IdentitySession" ("identityId", "familyId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, now() + interval '30 days')`,
          [presented.identityId, presented.familyId, hash(rotatedToken)],
        );

        const logout = post('logout', { refreshToken }).expect(204).then(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await rotation.commitTransaction();
        await logout;
      } finally {
        await rotation.release();
      }

      const [rotated] = await dataSource.query(`SELECT "revokedAt" FROM "IdentitySession" WHERE "tokenHash" = $1`, [hash(rotatedToken)]);
      expect(rotated.revokedAt).not.toBeNull();
      await post('refresh', { refreshToken: rotatedToken }).expect(401);
    });

    it('answers 204 again for an already revoked or unknown token', async () => {
      const { refreshToken } = await register();
      await post('logout', { refreshToken }).expect(204);

      await post('logout', { refreshToken }).expect(204);
      await post('logout', { refreshToken: 'A'.repeat(43) }).expect(204);
    });
  });

  describe('access token denylist', () => {
    function verify(accessToken: string) {
      return app.get(AccessTokenVerifierService).verify(accessToken);
    }

    it('carries the session family in the token and stores nothing for a live one', async () => {
      const { accessToken } = await register();
      const { sid } = await claimsOf(accessToken);
      const redis = app.get(RedisClientService).queue;

      expect(await verify(accessToken)).toMatchObject({ familyId: sid });
      expect([...(await redis.keys('denied-family:*')), ...(await redis.keys('session*'))]).toEqual([]);
    });

    it('kills every access token of the family on logout until it would expire anyway', async () => {
      const first = await register();
      const second = (await post('refresh', { refreshToken: first.refreshToken }).expect(200)).body;
      const { sid } = await claimsOf(first.accessToken);

      await post('logout', { refreshToken: second.refreshToken }).expect(204);

      await expect(verify(first.accessToken)).rejects.toThrow('Access token revoked');
      await expect(verify(second.accessToken)).rejects.toThrow('Access token revoked');
      expect(await app.get(RedisClientService).queue.ttl(`denied-family:${sid}`)).toBeGreaterThanOrEqual(900);
    });

    it('kills the family access tokens when a used refresh token is replayed', async () => {
      const first = await register();
      const second = (await post('refresh', { refreshToken: first.refreshToken }).expect(200)).body;

      await post('refresh', { refreshToken: first.refreshToken }).expect(401);

      await expect(verify(second.accessToken)).rejects.toThrow('Access token revoked');
    });

    it('leaves the tokens of another login alive on logout', async () => {
      const first = await register();
      const other = (await post('login', { login: 'jane@example.com', password: 'correct-horse' }).expect(200)).body;

      await post('logout', { refreshToken: first.refreshToken }).expect(204);

      await expect(verify(other.accessToken)).resolves.toMatchObject({ identityPublicId: expect.any(String) });
    });
  });

  describe('login rate limit', () => {
    it('answers 429 with Retry-After after 5 attempts for one login and ip in a minute', async () => {
      await register();
      const statuses = [];
      for (let i = 0; i < 5; i += 1) {
        statuses.push((await post('login', { login: 'jane@example.com', password: 'wrong-password' })).status);
      }

      const blocked = await post('login', { login: 'JANE@example.com', password: 'correct-horse' });

      expect(statuses).toEqual([401, 401, 401, 401, 401]);
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(59);
      expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
    });

    it('counts each login separately', async () => {
      await register();
      for (let i = 0; i < 5; i += 1) {
        await post('login', { login: 'attacker-target@example.com', password: 'wrong-password' });
      }

      await post('login', { login: 'jane@example.com', password: 'correct-horse' }).expect(200);
    });

    it('reports the remaining attempts', async () => {
      const response = await post('login', { login: 'jane@example.com', password: 'wrong-password' });

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });
  });
});
