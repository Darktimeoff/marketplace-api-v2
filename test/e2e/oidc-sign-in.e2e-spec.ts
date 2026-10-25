import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { decodeJwt } from 'jose';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { IdentityExternalAccount } from '../../src/identity/entity/identity-external-account.entity.js';
import { IdentityOutbox } from '../../src/identity/entity/identity-outbox.entity.js';
import { truncateAllTables } from '../support/isolation.js';
import { FakeOidcProvider } from '../support/fake-oidc-provider.js';

describe('Sign in with an OIDC provider (e2e)', () => {
  const google = new FakeOidcProvider(process.env.GOOGLE_CLIENT_ID as string, process.env.GOOGLE_CLIENT_SECRET as string);
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    await google.start();
    process.env.GOOGLE_ISSUER = google.issuer;
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    google.reset();
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
    await google.stop();
  });

  function stateCookie(response: request.Response): string {
    const cookies = [response.headers['set-cookie'] ?? []].flat() as string[];
    const cookie = cookies.find((value) => value.startsWith('oidc_sign_in_state='));

    if (!cookie) {
      throw new Error('no oidc_sign_in_state cookie');
    }

    return cookie.split(';')[0];
  }

  async function begin(): Promise<{ authorizeUrl: string; cookie: string }> {
    const response = await request(app.getHttpServer()).get('/auth/google').expect(302);
    return { authorizeUrl: response.headers.location as string, cookie: stateCookie(response) };
  }

  async function beginLink(accessToken: string, password = 'correct-horse'): Promise<{ authorizeUrl: string; cookie: string }> {
    const response = await request(app.getHttpServer())
      .post('/auth/google/link')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ password })
      .expect(200);
    return { authorizeUrl: (response.body as { url: string }).url, cookie: stateCookie(response) };
  }

  async function consent(authorizeUrl: string): Promise<string> {
    const response = await fetch(authorizeUrl, { redirect: 'manual' });
    const back = new URL(response.headers.get('location') as string);
    return `${back.pathname}${back.search}`;
  }

  function callback(path: string, cookie?: string) {
    const call = request(app.getHttpServer()).get(path);
    return cookie ? call.set('Cookie', cookie) : call;
  }

  async function signIn(status: number, body?: object): Promise<request.Response> {
    const { authorizeUrl, cookie } = await begin();
    const call = callback(await consent(authorizeUrl), cookie);
    return body ? call.expect(status, body) : call.expect(status);
  }

  async function registerWithPassword(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'correct-horse' })
      .expect(201);
    return (response.body as { accessToken: string }).accessToken;
  }

  function subjectOf(accessToken: string): string | undefined {
    return decodeJwt(accessToken).sub;
  }

  describe('start', () => {
    it('redirects to the provider with PKCE, state and nonce, and binds the state to the browser', async () => {
      const response = await request(app.getHttpServer()).get('/auth/google').expect(302);
      const authorize = new URL(response.headers.location as string);

      expect(`${authorize.origin}${authorize.pathname}`).toBe(`${google.issuer}/authorize`);
      expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
        client_id: process.env.GOOGLE_CLIENT_ID,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge_method: 'S256',
        redirect_uri: 'http://localhost:3000/auth/google/callback',
      });
      expect(authorize.searchParams.get('nonce')).toBeTruthy();
      expect(stateCookie(response)).toBe(`oidc_sign_in_state=${authorize.searchParams.get('state')}`);
      expect(response.headers['set-cookie']?.[0]).toMatch(/HttpOnly; SameSite=Lax/);
    });
  });

  describe('providers', () => {
    it('answers 400 for a provider that is not configured', async () => {
      await request(app.getHttpServer()).get('/auth/github').expect(400);
      await request(app.getHttpServer()).get('/auth/github/callback?code=x&state=y').expect(400);
    });

    it('keeps /auth/me a route of its own', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  describe('callback', () => {
    it('signs up a new identity without a password, links the account and emits identity.registered', async () => {
      const response = await signIn(200);
      const identity = await dataSource.getRepository(Identity).findOneByOrFail({ email: 'jane@gmail.com' });

      expect(response.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(subjectOf((response.body as { accessToken: string }).accessToken)).toBe(identity.publicId);
      expect(identity.passwordHash).toBeNull();
      expect(await dataSource.getRepository(IdentityExternalAccount).findBy({ identityId: identity.id })).toMatchObject([
        { provider: 'google', subject: '100000000000000000001' },
      ]);
      expect(await dataSource.getRepository(IdentityOutbox).findBy({ aggregateId: identity.publicId })).toMatchObject([
        { type: 'identity.registered' },
      ]);
    });

    it('signs the same Google account into the same identity, matched by sub even when the email changed', async () => {
      const first = await signIn(200);
      google.user = { ...google.user, email: 'jane.new@gmail.com' };
      const second = await signIn(200);

      expect(subjectOf((second.body as { accessToken: string }).accessToken)).toBe(
        subjectOf((first.body as { accessToken: string }).accessToken),
      );
      expect(await dataSource.getRepository(Identity).count()).toBe(1);
    });

    it('refuses a callback without the browser cookie (login CSRF) and keeps the attempt usable', async () => {
      const { authorizeUrl, cookie } = await begin();
      const path = await consent(authorizeUrl);

      await callback(path).expect(400, { message: 'Sign-in state does not match this browser', error: 'Bad Request', statusCode: 400 });
      await callback(path, 'oidc_sign_in_state=someone-else').expect(400);
      await callback(path, cookie).expect(200);
    });

    it('accepts a state only once', async () => {
      const { authorizeUrl, cookie } = await begin();
      const path = await consent(authorizeUrl);

      await callback(path, cookie).expect(200);
      await callback(path, cookie).expect(400, {
        message: 'Sign-in attempt expired or was already used',
        error: 'Bad Request',
        statusCode: 400,
      });
    });

    it('rejects a code the provider does not accept', async () => {
      const { authorizeUrl, cookie } = await begin();
      const path = (await consent(authorizeUrl)).replace(/code=[^&]+/, 'code=forged');

      await callback(path, cookie).expect(401, { message: 'Sign-in with google failed', error: 'Unauthorized', statusCode: 401 });
    });

    it('rejects an id_token with another nonce', async () => {
      google.behaviour = { nonce: 'replayed-nonce' };

      await signIn(401);
      expect(await dataSource.getRepository(Identity).count()).toBe(0);
    });

    it('rejects an id_token issued to another client', async () => {
      google.behaviour = { audience: 'another-client' };

      await signIn(401);
    });

    it('rejects a user who denied consent', async () => {
      google.behaviour = { deny: true };

      await signIn(401);
    });

    it('rejects a Google account without a verified email', async () => {
      google.user = { ...google.user, emailVerified: false };

      await signIn(401, { message: 'google account has no verified email', error: 'Unauthorized', statusCode: 401 });
      expect(await dataSource.getRepository(Identity).count()).toBe(0);
    });

    it('refuses to sign up over an existing identity with the same email', async () => {
      await registerWithPassword('jane@gmail.com');

      await signIn(409);
      expect(await dataSource.getRepository(IdentityExternalAccount).count()).toBe(0);
    });
  });

  describe('link', () => {
    it('requires a token', async () => {
      await request(app.getHttpServer()).post('/auth/google/link').send({ password: 'correct-horse' }).expect(401);
    });

    it('requires the password again', async () => {
      const accessToken = await registerWithPassword('jane@example.com');

      await request(app.getHttpServer())
        .post('/auth/google/link')
        .set('authorization', `Bearer ${accessToken}`)
        .send({ password: 'wrong-password' })
        .expect(403, { message: 'Password confirmation failed', error: 'Forbidden', statusCode: 403 });
    });

    it('links Google to a password identity, after which Google signs into it', async () => {
      const accessToken = await registerWithPassword('jane@example.com');
      const { authorizeUrl, cookie } = await beginLink(accessToken);

      await callback(await consent(authorizeUrl), cookie).expect(200);
      const signedIn = await signIn(200);

      expect(subjectOf((signedIn.body as { accessToken: string }).accessToken)).toBe(subjectOf(accessToken));
      expect(await dataSource.getRepository(Identity).count()).toBe(1);
    });

    it('refuses a Google account that already belongs to another identity', async () => {
      await signIn(200);
      const accessToken = await registerWithPassword('jane@example.com');
      const { authorizeUrl, cookie } = await beginLink(accessToken);

      await callback(await consent(authorizeUrl), cookie).expect(409, {
        message: 'This google account is linked to another identity',
        error: 'Conflict',
        statusCode: 409,
      });
    });

    it('refuses a second Google account on the same identity', async () => {
      const accessToken = await registerWithPassword('jane@example.com');
      const first = await beginLink(accessToken);
      await callback(await consent(first.authorizeUrl), first.cookie).expect(200);

      google.user = { sub: '100000000000000000002', email: 'jane.other@gmail.com', emailVerified: true };
      const second = await beginLink(accessToken);

      await callback(await consent(second.authorizeUrl), second.cookie).expect(409, {
        message: 'This identity already has a linked google account',
        error: 'Conflict',
        statusCode: 409,
      });
    });
  });
});
