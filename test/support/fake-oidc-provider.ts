import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';

export interface FakeOidcUserInterface {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export interface FakeOidcBehaviourInterface {
  deny?: boolean;
  nonce?: string;
  audience?: string;
}

interface IssuedCodeInterface {
  user: FakeOidcUserInterface;
  behaviour: FakeOidcBehaviourInterface;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
}

export class FakeOidcProvider {
  issuer: string;
  user: FakeOidcUserInterface = { sub: '100000000000000000001', email: 'jane@gmail.com', emailVerified: true };
  behaviour: FakeOidcBehaviourInterface = {};

  private server: Server;
  private privateKey: CryptoKey;
  private publicJwk: JWK;
  private readonly codes = new Map<string, IssuedCodeInterface>();

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async start(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    this.privateKey = privateKey;
    this.publicJwk = { ...jwk, kid: await calculateJwkThumbprint(jwk), alg: 'RS256', use: 'sig' };

    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error: unknown) => this.json(response, 500, { error: String(error) }));
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.issuer = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.server.close((error) => (error ? reject(error) : resolve())));
  }

  reset(): void {
    this.user = { sub: '100000000000000000001', email: 'jane@gmail.com', emailVerified: true };
    this.behaviour = {};
    this.codes.clear();
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', this.issuer);

    if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
      return this.json(response, 200, {
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        authorization_response_iss_parameter_supported: true,
      });
    }

    if (request.method === 'GET' && url.pathname === '/jwks') {
      return this.json(response, 200, { keys: [this.publicJwk] });
    }

    if (request.method === 'GET' && url.pathname === '/authorize') {
      return this.authorize(url, response);
    }

    if (request.method === 'POST' && url.pathname === '/token') {
      return this.token(request, response);
    }

    this.json(response, 404, { error: 'not_found' });
  }

  private authorize(url: URL, response: ServerResponse): void {
    const params = url.searchParams;
    const redirectUri = params.get('redirect_uri') ?? '';
    const back = new URL(redirectUri);
    back.searchParams.set('state', params.get('state') ?? '');
    back.searchParams.set('iss', this.issuer);

    if (this.behaviour.deny) {
      back.searchParams.set('error', 'access_denied');
    } else {
      const code = randomBytes(16).toString('base64url');
      this.codes.set(code, {
        user: { ...this.user },
        behaviour: { ...this.behaviour },
        clientId: params.get('client_id') ?? '',
        redirectUri,
        codeChallenge: params.get('code_challenge') ?? '',
        nonce: params.get('nonce') ?? '',
      });
      back.searchParams.set('code', code);
    }

    response.writeHead(302, { location: back.href }).end();
  }

  private async token(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const form = new URLSearchParams(await this.readBody(request));
    const issued = this.codes.get(form.get('code') ?? '');
    this.codes.delete(form.get('code') ?? '');

    if (form.get('client_id') !== this.clientId || form.get('client_secret') !== this.clientSecret) {
      return this.json(response, 401, { error: 'invalid_client' });
    }

    const verifierMatches =
      !!issued && createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url') === issued.codeChallenge;

    if (!issued || !verifierMatches || form.get('redirect_uri') !== issued.redirectUri || issued.clientId !== this.clientId) {
      return this.json(response, 400, { error: 'invalid_grant' });
    }

    const idToken = await new SignJWT({
      email: issued.user.email,
      email_verified: issued.user.emailVerified,
      nonce: issued.behaviour.nonce ?? issued.nonce,
    })
      .setProtectedHeader({ alg: 'RS256', kid: this.publicJwk.kid })
      .setIssuer(this.issuer)
      .setAudience(issued.behaviour.audience ?? this.clientId)
      .setSubject(issued.user.sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(this.privateKey);

    this.json(response, 200, {
      access_token: randomBytes(24).toString('base64url'),
      token_type: 'Bearer',
      expires_in: 3599,
      scope: 'openid email profile',
      id_token: idToken,
    });
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    let body = '';

    for await (const chunk of request) {
      body += chunk;
    }

    return body;
  }

  private json(response: ServerResponse, status: number, body: object): void {
    response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  }
}
