import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecretManagerService } from '../../../src/generic/secret-manager/secret-manager.service.js';
import type { EnvironmentService } from '../../../src/generic/environment/environment.module.js';

interface FakeInfisicalStateInterface {
  serviceAccountToken: string;
  issued: string[];
  revoked: Set<string>;
  logins: { identityId: string; jwt: string }[];
}

describe('SecretManagerService with INFISICAL_AUTH_METHOD=jwt', () => {
  const identityId = 'identity-kind';
  let server: Server;
  let siteUrl: string;
  let workDir: string;
  let tokenPath: string;
  let state: FakeInfisicalStateInterface;

  async function body(request: IncomingMessage): Promise<string> {
    let text = '';
    for await (const chunk of request) {
      text += chunk;
    }
    return text;
  }

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      response.setHeader('content-type', 'application/json');

      if (request.method === 'POST' && request.url === '/api/v1/auth/jwt-auth/login') {
        const login = JSON.parse(await body(request)) as { identityId: string; jwt: string };
        state.logins.push(login);

        if (login.identityId !== identityId || login.jwt !== state.serviceAccountToken) {
          response.writeHead(403).end(JSON.stringify({ message: 'subject not allowed' }));
          return;
        }

        const accessToken = `access-${state.issued.length + 1}`;
        state.issued.push(accessToken);
        response.end(JSON.stringify({ accessToken, expiresIn: 3600, tokenType: 'Bearer' }));
        return;
      }

      const secret = request.url?.match(/^\/api\/v3\/secrets\/raw\/([A-Z_]+)\?/);
      const accessToken = request.headers.authorization?.replace('Bearer ', '') ?? '';

      if (request.method === 'GET' && secret && state.issued.includes(accessToken) && !state.revoked.has(accessToken)) {
        response.end(JSON.stringify({ secret: { secretKey: secret[1], secretValue: `${secret[1]} via ${accessToken}` } }));
        return;
      }

      response.writeHead(401).end(JSON.stringify({ message: 'unauthorized' }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    siteUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    workDir = await mkdtemp(join(tmpdir(), 'secret-manager-'));
    tokenPath = join(workDir, 'token');
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    state = { serviceAccountToken: 'sa-token-1', issued: [], revoked: new Set(), logins: [] };
    await writeFile(tokenPath, `${state.serviceAccountToken}\n`);
  });

  function aService(overrides: Record<string, string> = {}) {
    const settings: Record<string, string> = {
      INFISICAL_SITE_URL: siteUrl,
      INFISICAL_AUTH_METHOD: 'jwt',
      INFISICAL_IDENTITY_ID: identityId,
      INFISICAL_JWT_PATH: tokenPath,
      INFISICAL_PROJECT_ID: 'project',
      INFISICAL_ENVIRONMENT: 'dev',
      ...overrides,
    };
    const environment = { get: (key: string) => settings[key] } as unknown as EnvironmentService;

    return new SecretManagerService(environment);
  }

  it('logs in with the ServiceAccount token from the file and reads secrets with the access token it got', async () => {
    const service = aService();

    await service.onModuleInit();

    expect(state.logins).toEqual([{ identityId, jwt: 'sa-token-1' }]);
    expect(await service.get('DBPASSWORD')).toBe('DBPASSWORD via access-1');
    expect(await service.get('REDIS_PASSWORD')).toBe('REDIS_PASSWORD via access-1');
    expect(state.logins).toHaveLength(1);
  });

  it('logs in again with the token kubelet rotated into the file when the access token stops working', async () => {
    const service = aService();
    await service.onModuleInit();

    state.revoked.add('access-1');
    state.serviceAccountToken = 'sa-token-2';
    await writeFile(tokenPath, 'sa-token-2');

    expect(await service.get('JWT_PUBLIC_KEY')).toBe('JWT_PUBLIC_KEY via access-2');
    expect(state.logins.map((login) => login.jwt)).toEqual(['sa-token-1', 'sa-token-2']);
  });

  it('fails the start when the vault refuses the token, naming the status', async () => {
    await writeFile(tokenPath, 'token-of-another-service-account');

    await expect(aService().onModuleInit()).rejects.toThrow('Infisical JWT login answered 403');
  });

  it('fails the start without INFISICAL_IDENTITY_ID, naming it', async () => {
    await expect(aService({ INFISICAL_IDENTITY_ID: '' }).onModuleInit()).rejects.toThrow(
      'INFISICAL_IDENTITY_ID is required with INFISICAL_AUTH_METHOD=jwt',
    );
  });
});
