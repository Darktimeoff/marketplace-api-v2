import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { VAULT_SECRET_NAMES, missingPodVaultVariables, missingVaultVariables, pickVaultSecrets } from './vault.ts';
import { otelCollector } from './otel-collector.ts';
import { networkPolicies } from './network-policies.ts';
import { apiGateway, envoyGateway } from './gateway.ts';
import { tls } from './tls.ts';

const podReadsVault = process.env.SKIP_VAULT !== '1';

if (podReadsVault) {
  const missingForPods = missingPodVaultVariables(process.env);

  if (missingForPods.length > 0) {
    throw new pulumi.RunError(
      `Missing for the pods to read the vault: ${missingForPods.join(', ')}. Run through npm run up, or deploy with SKIP_VAULT=1 and the secrets exported.`,
    );
  }
} else {
  const missing = missingVaultVariables(process.env);

  if (missing.length > 0) {
    throw new pulumi.RunError(
      `Missing from the vault: ${missing.join(', ')}. Run through scripts/with-secrets.sh, or export them with SKIP_VAULT=1.`,
    );
  }
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
const observabilityNamespaceName = config.get('observabilityNamespace') ?? 'observability';
const otlpEndpoint = config.get('otlpEndpoint') ?? `http://otel-collector.${observabilityNamespaceName}:4318`;
const tracesEndpoint = config.get('tracesEndpoint') ?? 'http://tempo:4318';
const remoteWriteEndpoint = config.get('remoteWriteEndpoint') ?? 'http://prometheus:9090/api/v1/write';
const logsEndpoint = config.get('logsEndpoint') ?? 'http://loki:3100/otlp';
const caDir = config.get('caDir') ?? '../secrets/tls';
const clusterTlsMode = process.env.CLUSTER_TLS_MODE?.trim() || 'disable';

if (clusterTlsMode !== 'disable' && clusterTlsMode !== 'verify-full') {
  throw new pulumi.RunError(`CLUSTER_TLS_MODE must be disable or verify-full, got ${clusterTlsMode}`);
}

const dependenciesTls = clusterTlsMode === 'verify-full';
const caFile = resolve(caDir, 'ca.crt');

if (!existsSync(caFile)) {
  throw new pulumi.RunError(`Local CA not found in ${caDir}: run bash scripts/bootstrap-tls.sh`);
}

const dependenciesCa = readFileSync(caFile, 'utf8');
const caMountPath = '/etc/marketplace-ca';
const tlsSecretName = 'marketplace-tls';
const networkCidrs = { dependenciesCidr: process.env.DEPENDENCIES_CIDR?.trim(), observabilityCidr: process.env.OBSERVABILITY_CIDR?.trim(), apiServerCidr: process.env.API_SERVER_CIDR?.trim() };
const missingCidrs = Object.entries(networkCidrs).filter(([, value]) => !value).map(([key]) => key);

if (missingCidrs.length > 0) {
  throw new pulumi.RunError(`Missing network ranges: ${missingCidrs.join(', ')}. scripts/infra.sh reads them from docker; export them when running pulumi directly.`);
}

if (terminationGraceSeconds * 1000 <= drainMs) {
  throw new pulumi.RunError(`terminationGraceSeconds (${terminationGraceSeconds}) must be longer than drainMs (${drainMs} ms)`);
}

if (minReplicas < 2) {
  throw new pulumi.RunError(`minReplicas (${minReplicas}) must be at least 2: one pod cannot be drained without downtime`);
}

const name = 'marketplace-api';
const labels = { app: name };
const port = 3000;
const metricsPort = 9464;

const settings: Record<string, string> = {
  NODE_ENV: 'production',
  PORT: String(port),
  DBHOST: 'db-bouncer',
  DBPORT: '5432',
  DBNAME: 'api',
  RABBITMQ_HOST: 'rabbitmq',
  RABBITMQ_PORT: dependenciesTls ? '5671' : '5672',
  KAFKA_BROKERS: dependenciesTls ? 'kafka:29093' : 'kafka:29092',
  REDIS_CACHE_HOST: 'redis-cache',
  REDIS_CACHE_PORT: '6379',
  REDIS_QUEUE_HOST: 'redis-queue',
  REDIS_QUEUE_PORT: '6379',
  TEMPORAL_ADDRESS: dependenciesTls ? 'temporal-tls:7234' : 'temporal:7233',
  TLS_MODE: clusterTlsMode,
  ...(dependenciesTls ? { TLS_CA_PATH: `${caMountPath}/ca.crt` } : {}),
  TEMPORAL_NAMESPACE: 'default',
  STORAGE_ENDPOINT: 'http://minio:9000',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'marketplace-media',
  MEDIA_PUBLIC_BASE_URL: 'http://localhost:8088',
  OIDC_REDIRECT_BASE_URL: `https://localhost:${nodePort}`,
  TRUST_PROXY_HOPS: '1',
  GOOGLE_CLIENT_ID: googleClientId,
  DRAIN_MS: String(drainMs),
  METRICS_PORT: String(metricsPort),
  OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint,
  REV: rev,
};

const tokenDir = '/var/run/secrets/infisical';

const vaultTrustStack = config.get('vaultTrustStack') ?? `organization/vault-trust/${pulumi.getStack()}`;

const vaultSettings: Record<string, pulumi.Input<string>> = podReadsVault
  ? {
      INFISICAL_AUTH_METHOD: 'jwt',
      INFISICAL_SITE_URL: 'http://infisical-backend:8080',
      INFISICAL_IDENTITY_ID: new pulumi.StackReference(vaultTrustStack).requireOutput('identityId') as pulumi.Output<string>,
      INFISICAL_JWT_PATH: `${tokenDir}/token`,
      INFISICAL_PROJECT_ID: process.env.INFISICAL_PROJECT_ID!.trim(),
      INFISICAL_ENVIRONMENT: process.env.INFISICAL_ENVIRONMENT!.trim(),
    }
  : {
      SKIP_VAULT: '1',
      INFISICAL_SITE_URL: 'http://infisical:8080',
      INFISICAL_CLIENT_ID: 'unused-with-skip-vault',
      INFISICAL_PROJECT_ID: 'unused-with-skip-vault',
      INFISICAL_ENVIRONMENT: 'dev',
    };

const secretsChecksum = createHash('sha256')
  .update(VAULT_SECRET_NAMES.map((key) => `${key}=${secrets[key]}`).join('\n'))
  .digest('hex');

const provider = new k8s.Provider('kind', { context: kubeContext });

type PodSecurityLevelType = 'restricted' | 'baseline' | 'privileged';

function podSecurity(level: PodSecurityLevelType, enforce: PodSecurityLevelType | null = level): Record<string, string> {
  return {
    ...(enforce ? { 'pod-security.kubernetes.io/enforce': enforce } : {}),
    'pod-security.kubernetes.io/warn': level,
    'pod-security.kubernetes.io/audit': level,
  };
}

const namespace = new k8s.core.v1.Namespace(
  namespaceName,
  { metadata: { name: namespaceName, labels: podSecurity('restricted') } },
  { provider },
);

const observabilityNamespace = new k8s.core.v1.Namespace(
  observabilityNamespaceName,
  { metadata: { name: observabilityNamespaceName, labels: podSecurity('privileged') } },
  { provider },
);

otelCollector({ namespace: observabilityNamespace.metadata.name, appNamespace: namespace.metadata.name, tracesEndpoint, remoteWriteEndpoint, logsEndpoint }, { provider });
const gatewayController = envoyGateway({ provider });
for (const platformNamespace of ['envoy-gateway-system', 'cert-manager']) {
  new k8s.core.v1.NamespacePatch(
    `${platformNamespace}-pod-security`,
    { metadata: { name: platformNamespace, labels: podSecurity('restricted') } },
    { provider, dependsOn: [gatewayController] },
  );
}

tls({ caDir, namespace: namespace.metadata.name, secretName: tlsSecretName, dnsNames: ['marketplace.localhost', 'localhost'] }, { provider });
networkPolicies({ namespace: namespace.metadata.name, observabilityNamespace: observabilityNamespace.metadata.name, ...(networkCidrs as Record<keyof typeof networkCidrs, string>) }, { provider });

const secret = podReadsVault
  ? undefined
  : new k8s.core.v1.Secret(
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

const serviceAccount = podReadsVault
  ? new k8s.core.v1.ServiceAccount(
      name,
      {
        metadata: { name, namespace: namespace.metadata.name, labels },
        automountServiceAccountToken: false,
      },
      { provider },
    )
  : undefined;

const podSecurityContext = {
  runAsNonRoot: true,
  runAsUser: 65532,
  runAsGroup: 65532,
  seccompProfile: { type: 'RuntimeDefault' },
};

const containerSecurityContext = {
  allowPrivilegeEscalation: false,
  readOnlyRootFilesystem: true,
  capabilities: { drop: ['ALL'] },
};

const podIdentityEnv = [
  { name: 'POD_NAME', valueFrom: { fieldRef: { fieldPath: 'metadata.name' } } },
  { name: 'POD_NAMESPACE', valueFrom: { fieldRef: { fieldPath: 'metadata.namespace' } } },
  { name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } },
  { name: 'OTEL_RESOURCE_ATTRIBUTES', value: 'k8s.pod.name=$(POD_NAME),k8s.namespace.name=$(POD_NAMESPACE),k8s.node.name=$(NODE_NAME)' },
];

const podEnv = [
  ...podIdentityEnv,
  ...Object.entries({ ...settings, ...vaultSettings }).map(([key, value]) => ({ name: key, value })),
  ...(secret
    ? VAULT_SECRET_NAMES.map((key) => ({
        name: key,
        valueFrom: { secretKeyRef: { name: secret.metadata.name, key } },
      }))
    : []),
];

const caConfigMap = new k8s.core.v1.ConfigMap(
  'dependencies-ca',
  { metadata: { name: 'dependencies-ca', namespace: namespace.metadata.name }, data: { 'ca.crt': dependenciesCa } },
  { provider },
);

const podVolumeMounts = [
  { name: 'tmp', mountPath: '/tmp' },
  { name: 'dependencies-ca', mountPath: caMountPath, readOnly: true },
  ...(podReadsVault ? [{ name: 'infisical-token', mountPath: tokenDir, readOnly: true }] : []),
];

const podVolumes = [
  { name: 'tmp', emptyDir: { sizeLimit: '512Mi' } },
  { name: 'dependencies-ca', configMap: { name: caConfigMap.metadata.name } },
  ...(podReadsVault
    ? [
        {
          name: 'infisical-token',
          projected: {
            sources: [{ serviceAccountToken: { audience: 'infisical', expirationSeconds: 3600, path: 'token' } }],
          },
        },
      ]
    : []),
];

const migrateLabels = { app: `${name}-migrate` };

const migrateJob = new k8s.batch.v1.Job(
  `${name}-migrate`,
  {
    metadata: { name: `${name}-migrate-${image.split(':').pop()}`, namespace: namespace.metadata.name, labels: migrateLabels },
    spec: {
      backoffLimit: 2,
      activeDeadlineSeconds: 300,
      template: {
        metadata: { labels: migrateLabels },
        spec: {
          restartPolicy: 'Never',
          serviceAccountName: serviceAccount?.metadata.name,
          automountServiceAccountToken: false,
          securityContext: podSecurityContext,
          containers: [
            {
              name: 'migrate',
              image,
              imagePullPolicy: 'IfNotPresent',
              args: ['dist/migrate.js'],
              env: podEnv,
              resources: {
                requests: { cpu: '100m', memory: '256Mi' },
                limits: { memory: '512Mi' },
              },
              securityContext: containerSecurityContext,
              volumeMounts: podVolumeMounts,
            },
          ],
          volumes: podVolumes,
        },
      },
    },
  },
  { provider, deleteBeforeReplace: true },
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
          annotations: {
            'prometheus.io/scrape': 'true',
            'prometheus.io/port': String(metricsPort),
            'marketplace/ca-checksum': createHash('sha256').update(dependenciesCa).digest('hex'),
            ...(secret ? { 'marketplace/secrets-checksum': secretsChecksum } : {}),
          },
        },
        spec: {
          terminationGracePeriodSeconds: terminationGraceSeconds,
          serviceAccountName: serviceAccount?.metadata.name,
          automountServiceAccountToken: false,
          securityContext: podSecurityContext,
          containers: [
            {
              name: 'api',
              image,
              imagePullPolicy: 'IfNotPresent',
              ports: [
                { name: 'http', containerPort: port },
                { name: 'metrics', containerPort: metricsPort },
              ],
              env: podEnv,
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
              securityContext: containerSecurityContext,
              volumeMounts: podVolumeMounts,
            },
          ],
          volumes: podVolumes,
        },
      },
    },
  },
  { provider, dependsOn: [migrateJob] },
);

const service = new k8s.core.v1.Service(
  name,
  {
    metadata: { name, namespace: namespace.metadata.name, labels },
    spec: {
      type: 'ClusterIP',
      selector: labels,
      ports: [{ name: 'http', port: 80, targetPort: 'http' }],
    },
  },
  { provider },
);

apiGateway({ namespace: namespace.metadata.name, collectorNamespace: observabilityNamespace.metadata.name, name, nodePort, tlsSecretName, service }, gatewayController, { provider });

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

export const migrateJobName = migrateJob.metadata.name;
export const url = `https://localhost:${nodePort}`;
export const deployedRev = rev;
