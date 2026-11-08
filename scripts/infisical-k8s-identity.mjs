import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createPublicKey } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseEnvFile } from 'dotenv';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const identityName = process.env.INFISICAL_K8S_IDENTITY ?? 'marketplace-api-kind';
const kubeContext = process.env.KUBE_CONTEXT ?? 'kind-marketplace';
const namespace = process.env.K8S_NAMESPACE ?? 'marketplace';
const serviceAccount = process.env.K8S_SERVICE_ACCOUNT ?? 'marketplace-api';
const projectRole = 'viewer';
const accessTokenTtlSeconds = 3600;

async function main() {
  const env = { ...parseEnvFile(await readFile(path.join(rootDir, '.env'), 'utf8')), ...process.env };
  const api = `${env.INFISICAL_SITE_URL}/api`;
  const client = { api, token: await login(api, env.INFISICAL_CLIENT_ID, (await readFile(path.join(rootDir, 'secrets', 'infisical_client_secret.txt'), 'utf8')).trim()) };

  const { workspace } = await request(client, 'GET', `/v1/workspace/${env.INFISICAL_PROJECT_ID}`);
  const identityId = await findOrCreateIdentity(client, workspace.orgId);
  await ensureProjectRole(client, env.INFISICAL_PROJECT_ID, identityId);

  const cluster = clusterKeys();
  const config = {
    configurationType: 'static',
    publicKeys: cluster.publicKeys,
    boundIssuer: cluster.issuer,
    boundAudiences: '',
    boundSubject: `system:serviceaccount:${namespace}:${serviceAccount}`,
    boundClaims: {},
    accessTokenTTL: accessTokenTtlSeconds,
    accessTokenMaxTTL: accessTokenTtlSeconds,
  };
  const { identity } = await request(client, 'GET', `/v1/identities/${identityId}`);
  const existing = identity.identity.authMethods.includes('jwt-auth');
  await request(client, existing ? 'PATCH' : 'POST', `/v1/auth/jwt-auth/identities/${identityId}`, config);

  console.error(
    `${identityName}: JWT auth ${existing ? 'updated' : 'attached'}, issuer ${cluster.issuer}, ${cluster.publicKeys.length} key(s), subject ${config.boundSubject}, project role ${projectRole}`,
  );
  console.log(identityId);
}

async function login(api, clientId, clientSecret) {
  const response = await fetch(`${api}/v1/auth/universal-auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    throw new Error(`universal-auth login answered ${response.status}`);
  }

  return (await response.json()).accessToken;
}

async function request(client, method, route, body, allowNotFound = false) {
  const response = await fetch(`${client.api}${route}`, {
    method,
    headers: { authorization: `Bearer ${client.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${method} ${route} answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  return response.json();
}

async function findOrCreateIdentity(client, orgId) {
  const { identityMemberships } = await request(client, 'GET', `/v2/organizations/${orgId}/identity-memberships?limit=100`);
  const found = identityMemberships.find((membership) => membership.identity.name === identityName);

  if (found) {
    return found.identity.id;
  }

  const { identity } = await request(client, 'POST', '/v1/identities', { name: identityName, organizationId: orgId, role: 'no-access' });
  return identity.id;
}

async function ensureProjectRole(client, projectId, identityId) {
  const membership = await request(client, 'GET', `/v1/projects/${projectId}/identity-memberships/${identityId}`, undefined, true);

  if (!membership) {
    await request(client, 'POST', `/v1/projects/${projectId}/identity-memberships/${identityId}`, { role: projectRole });
  }
}

function kubeRaw(route) {
  return JSON.parse(execFileSync('kubectl', ['--context', kubeContext, 'get', '--raw', route], { encoding: 'utf8' }));
}

function clusterKeys() {
  const { issuer } = kubeRaw('/.well-known/openid-configuration');
  const publicKeys = kubeRaw('/openid/v1/jwks').keys.map((jwk) => createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }));

  return { issuer, publicKeys };
}

main().catch((error) => {
  console.error('Failed to configure the Kubernetes identity in Infisical:', error.message);
  process.exit(1);
});
