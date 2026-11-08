import { createHash } from 'node:crypto';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { VAULT_SECRET_NAMES, missingVaultVariables, pickVaultSecrets } from './vault.ts';

const missing = missingVaultVariables(process.env);

if (missing.length > 0) {
  throw new pulumi.RunError(
    `Missing from the vault: ${missing.join(', ')}. Run through scripts/with-secrets.sh, or export them with SKIP_VAULT=1.`,
  );
}

const secrets = pickVaultSecrets(process.env);

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const image = process.env.IMAGE_REF?.trim();
const missingSettings = [!googleClientId && 'GOOGLE_CLIENT_ID', !image && 'IMAGE_REF'].filter(Boolean);

if (!googleClientId || !image) {
  throw new pulumi.RunError(
    `Missing setting: ${missingSettings.join(', ')}. GOOGLE_CLIENT_ID comes from .env through scripts/with-secrets.sh, IMAGE_REF from scripts/infra.sh; export them with SKIP_VAULT=1.`,
  );
}

const config = new pulumi.Config();
const kubeContext = config.get('kubeContext') ?? 'kind-marketplace';
const namespaceName = config.get('namespace') ?? 'marketplace';
const rev = config.get('rev') ?? '1';
const drainMs = config.getNumber('drainMs') ?? 5000;
const terminationGraceSeconds = config.getNumber('terminationGraceSeconds') ?? Math.ceil(drainMs / 1000) + 10;
const minReplicas = config.getNumber('minReplicas') ?? 2;
const maxReplicas = config.getNumber('maxReplicas') ?? 4;
const nodePort = config.getNumber('nodePort') ?? 30080;

if (terminationGraceSeconds * 1000 <= drainMs) {
  throw new pulumi.RunError(`terminationGraceSeconds (${terminationGraceSeconds}) must be longer than drainMs (${drainMs} ms)`);
}

if (minReplicas < 2) {
  throw new pulumi.RunError(`minReplicas (${minReplicas}) must be at least 2: one pod cannot be drained without downtime`);
}

const name = 'marketplace-api';
const labels = { app: name };
const port = 3000;

const settings: Record<string, string> = {
  NODE_ENV: 'production',
  SKIP_VAULT: '1',
  PORT: String(port),
  DBHOST: 'db-bouncer',
  DBPORT: '5432',
  DBNAME: 'api',
  RABBITMQ_HOST: 'rabbitmq',
  RABBITMQ_PORT: '5672',
  KAFKA_BROKERS: 'kafka:29092',
  REDIS_CACHE_HOST: 'redis-cache',
  REDIS_CACHE_PORT: '6379',
  REDIS_QUEUE_HOST: 'redis-queue',
  REDIS_QUEUE_PORT: '6379',
  TEMPORAL_ADDRESS: 'temporal:7233',
  TEMPORAL_NAMESPACE: 'default',
  STORAGE_ENDPOINT: 'http://minio:9000',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'marketplace-media',
  MEDIA_PUBLIC_BASE_URL: 'http://localhost:8088',
  OIDC_REDIRECT_BASE_URL: `http://localhost:${nodePort}`,
  GOOGLE_CLIENT_ID: googleClientId,
  INFISICAL_SITE_URL: 'http://infisical:8080',
  INFISICAL_CLIENT_ID: 'unused-with-skip-vault',
  INFISICAL_PROJECT_ID: 'unused-with-skip-vault',
  INFISICAL_ENVIRONMENT: 'dev',
  DRAIN_MS: String(drainMs),
  REV: rev,
};

const secretsChecksum = createHash('sha256')
  .update(VAULT_SECRET_NAMES.map((key) => `${key}=${secrets[key]}`).join('\n'))
  .digest('hex');

const provider = new k8s.Provider('kind', { context: kubeContext });

const namespace = new k8s.core.v1.Namespace(
  namespaceName,
  { metadata: { name: namespaceName } },
  { provider },
);

const secret = new k8s.core.v1.Secret(
  `${name}-secrets`,
  {
    metadata: { name: `${name}-secrets`, namespace: namespace.metadata.name, labels },
    type: 'Opaque',
    data: pulumi.secret(
      Object.fromEntries(VAULT_SECRET_NAMES.map((key) => [key, Buffer.from(secrets[key]).toString('base64')])),
    ),
  },
  { provider },
);

const deployment = new k8s.apps.v1.Deployment(
  name,
  {
    metadata: { name, namespace: namespace.metadata.name, labels },
    spec: {
      selector: { matchLabels: labels },
      revisionHistoryLimit: 5,
      progressDeadlineSeconds: 180,
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: { maxUnavailable: 0, maxSurge: 1 },
      },
      template: {
        metadata: {
          labels,
          annotations: { 'marketplace/secrets-checksum': secretsChecksum },
        },
        spec: {
          terminationGracePeriodSeconds: terminationGraceSeconds,
          automountServiceAccountToken: false,
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 65532,
            runAsGroup: 65532,
            seccompProfile: { type: 'RuntimeDefault' },
          },
          containers: [
            {
              name: 'api',
              image,
              imagePullPolicy: 'IfNotPresent',
              ports: [{ name: 'http', containerPort: port }],
              env: [
                ...Object.entries(settings).map(([key, value]) => ({ name: key, value })),
                ...VAULT_SECRET_NAMES.map((key) => ({
                  name: key,
                  valueFrom: { secretKeyRef: { name: secret.metadata.name, key } },
                })),
              ],
              resources: {
                requests: { cpu: '250m', memory: '384Mi' },
                limits: { memory: '768Mi' },
              },
              startupProbe: {
                httpGet: { path: '/healthz', port: 'http' },
                periodSeconds: 1,
                failureThreshold: 60,
              },
              readinessProbe: {
                httpGet: { path: '/readyz', port: 'http' },
                periodSeconds: 2,
                timeoutSeconds: 1,
                failureThreshold: 1,
                successThreshold: 1,
              },
              livenessProbe: {
                httpGet: { path: '/healthz', port: 'http' },
                periodSeconds: 10,
                timeoutSeconds: 2,
                failureThreshold: 3,
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ['ALL'] },
              },
              volumeMounts: [{ name: 'tmp', mountPath: '/tmp' }],
            },
          ],
          volumes: [{ name: 'tmp', emptyDir: { sizeLimit: '512Mi' } }],
        },
      },
    },
  },
  { provider },
);

const service = new k8s.core.v1.Service(
  name,
  {
    metadata: { name, namespace: namespace.metadata.name, labels },
    spec: {
      type: 'NodePort',
      selector: labels,
      ports: [{ name: 'http', port: 80, targetPort: 'http', nodePort }],
    },
  },
  { provider },
);

new k8s.policy.v1.PodDisruptionBudget(
  name,
  {
    metadata: { name, namespace: namespace.metadata.name, labels },
    spec: {
      maxUnavailable: 1,
      selector: { matchLabels: labels },
    },
  },
  { provider },
);

new k8s.autoscaling.v2.HorizontalPodAutoscaler(
  name,
  {
    metadata: { name, namespace: namespace.metadata.name, labels },
    spec: {
      scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: deployment.metadata.name },
      minReplicas,
      maxReplicas,
      metrics: [
        {
          type: 'Resource',
          resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } },
        },
      ],
    },
  },
  { provider },
);

export const url = pulumi.interpolate`http://localhost:${service.spec.ports[0].nodePort}`;
export const deployedRev = rev;
