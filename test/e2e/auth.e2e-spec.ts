import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import { AppModule } from '../../src/app.module.js';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { IdentitySession } from '../../src/identity/entity/identity-session.entity.js';
import { CountryCodeEnum } from '@marketplace/contracts-core';
import { truncateAllTables } from '../support/isolation.js';

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

    it('answers 204 again for an already revoked or unknown token', async () => {
      const { refreshToken } = await register();
      await post('logout', { refreshToken }).expect(204);

      await post('logout', { refreshToken }).expect(204);
      await post('logout', { refreshToken: 'A'.repeat(43) }).expect(204);
    });
  });
});
