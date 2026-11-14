import { execFileSync } from 'node:child_process';
import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as pulumi from '@pulumi/pulumi';
import * as infisical from '@pulumi/infisical';

const settings = {
  INFISICAL_SITE_URL: process.env.INFISICAL_SITE_URL?.trim(),
  INFISICAL_ADMIN_CLIENT_ID: process.env.INFISICAL_ADMIN_CLIENT_ID?.trim(),
  INFISICAL_PROJECT_ID: process.env.INFISICAL_PROJECT_ID?.trim(),
};
const missing = Object.entries(settings).filter(([, value]) => !value).map(([key]) => key);

if (missing.length > 0) {
  throw new pulumi.RunError(`Missing setting: ${missing.join(', ')}. They come from .env through scripts/with-secrets.sh.`);
}

const config = new pulumi.Config();
const kubeContext = config.get('kubeContext') ?? 'kind-marketplace';
const namespace = config.get('namespace') ?? 'marketplace';
const serviceAccount = config.get('serviceAccount') ?? 'marketplace-api';
const identityName = config.get('identityName') ?? 'marketplace-api-kind';
const localIdentityName = config.get('localIdentityName') ?? 'marketplace-api-local';
const clientSecretPath = path.resolve(import.meta.dirname, '../../secrets/infisical_admin_client_secret.txt');
const accessTokenTtlSeconds = 3600;

function kubeRaw(route: string) {
  return JSON.parse(execFileSync('kubectl', ['--context', kubeContext, 'get', '--raw', route], { encoding: 'utf8' }));
}

const { issuer } = kubeRaw('/.well-known/openid-configuration') as { issuer: string };
const publicKeys = (kubeRaw('/openid/v1/jwks') as { keys: JsonWebKey[] }).keys.map((jwk) =>
  createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString(),
);

const provider = new infisical.Provider('infisical', {
  host: settings.INFISICAL_SITE_URL,
  auth: {
    universal: {
      clientId: settings.INFISICAL_ADMIN_CLIENT_ID,
      clientSecret: pulumi.secret(readFileSync(clientSecretPath, 'utf8').trim()),
    },
  },
});

const project = infisical.getProjectsOutput({ id: settings.INFISICAL_PROJECT_ID }, { provider });

const identity = new infisical.Identity(
  identityName,
  { name: identityName, orgId: project.orgId, role: 'no-access' },
  { provider },
);

new infisical.ProjectIdentity(
  identityName,
  { projectId: project.id, identityId: identity.id, roles: [{ roleSlug: 'viewer' }] },
  { provider },
);

const subject = `system:serviceaccount:${namespace}:${serviceAccount}`;

new infisical.IdentityJwtAuth(
  identityName,
  {
    identityId: identity.id,
    configurationType: 'static',
    publicKeys,
    boundIssuer: issuer,
    boundSubject: subject,
    accessTokenTtl: accessTokenTtlSeconds,
    accessTokenMaxTtl: accessTokenTtlSeconds,
  },
  { provider },
);

const localIdentity = new infisical.Identity(
  localIdentityName,
  { name: localIdentityName, orgId: project.orgId, role: 'no-access' },
  { provider },
);

new infisical.ProjectIdentity(
  localIdentityName,
  { projectId: project.id, identityId: localIdentity.id, roles: [{ roleSlug: 'viewer' }] },
  { provider },
);

const localUniversalAuth = new infisical.IdentityUniversalAuth(
  localIdentityName,
  { identityId: localIdentity.id, accessTokenTtl: accessTokenTtlSeconds, accessTokenMaxTtl: accessTokenTtlSeconds },
  { provider },
);

const localClientSecret = new infisical.IdentityUniversalAuthClientSecret(
  localIdentityName,
  { identityId: localIdentity.id, description: 'local app, with-secrets.sh, bootstrap:secrets' },
  { provider, dependsOn: [localUniversalAuth] },
);

export const identityId = identity.id;
export const localClientId = localClientSecret.clientId;
export const localClientSecretValue = pulumi.secret(localClientSecret.clientSecret);
export const boundIssuer = issuer;
export const boundSubject = subject;
export const clusterKeys = publicKeys.length;
