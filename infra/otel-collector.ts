import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

const name = 'otel-collector';
const labels = { app: name };
const image = 'otel/opentelemetry-collector-contrib:0.164.0@sha256:340c9ca6a36617084c6661bdc4f0fe92b7cda5a805d61673ec8db375fddc522b';
const otlpPort = 4318;
const healthPort = 13133;

export interface OtelCollectorArgsInterface {
  namespace: pulumi.Input<string>;
  tracesEndpoint: string;
  remoteWriteEndpoint: string;
}

function collectorConfig(namespace: string, args: OtelCollectorArgsInterface): string {
  return JSON.stringify({
    extensions: { health_check: { endpoint: `0.0.0.0:${healthPort}` } },
    receivers: {
      otlp: { protocols: { http: { endpoint: `0.0.0.0:${otlpPort}` } } },
      prometheus: {
        config: {
          scrape_configs: [
            {
              job_name: 'marketplace-api',
              scrape_interval: '5s',
              kubernetes_sd_configs: [
                { role: 'pod', namespaces: { names: [namespace] }, selectors: [{ role: 'pod', field: 'spec.nodeName=${env:NODE_NAME}' }] },
              ],
              relabel_configs: [
                { source_labels: ['__meta_kubernetes_pod_annotation_prometheus_io_scrape'], action: 'keep', regex: 'true' },
                { source_labels: ['__meta_kubernetes_pod_container_port_name'], action: 'keep', regex: 'metrics' },
                { source_labels: ['__meta_kubernetes_pod_name'], target_label: 'pod' },
                { source_labels: ['__meta_kubernetes_namespace'], target_label: 'namespace' },
                { source_labels: ['__meta_kubernetes_pod_node_name'], target_label: 'node' },
              ],
            },
          ],
        },
      },
    },
    processors: {
      memory_limiter: { check_interval: '1s', limit_percentage: 80, spike_limit_percentage: 20 },
      batch: {},
    },
    exporters: {
      otlp_http: { endpoint: args.tracesEndpoint, tls: { insecure: true } },
      prometheus_remote_write: { endpoint: args.remoteWriteEndpoint, tls: { insecure: true } },
    },
    service: {
      extensions: ['health_check'],
      pipelines: {
        traces: { receivers: ['otlp'], processors: ['memory_limiter', 'batch'], exporters: ['otlp_http'] },
        metrics: { receivers: ['prometheus'], processors: ['memory_limiter', 'batch'], exporters: ['prometheus_remote_write'] },
      },
    },
  });
}

export function otelCollector(args: OtelCollectorArgsInterface, opts: pulumi.CustomResourceOptions): k8s.core.v1.Service {
  const serviceAccount = new k8s.core.v1.ServiceAccount(name, { metadata: { name, namespace: args.namespace } }, opts);

  const role = new k8s.rbac.v1.Role(
    name,
    {
      metadata: { name, namespace: args.namespace },
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] }],
    },
    opts,
  );

  new k8s.rbac.v1.RoleBinding(
    name,
    {
      metadata: { name, namespace: args.namespace },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: role.metadata.name },
      subjects: [{ kind: 'ServiceAccount', name: serviceAccount.metadata.name, namespace: args.namespace }],
    },
    opts,
  );

  const config = new k8s.core.v1.ConfigMap(
    name,
    {
      metadata: { name, namespace: args.namespace },
      data: { 'config.json': pulumi.output(args.namespace).apply(namespace => collectorConfig(namespace, args)) },
    },
    opts,
  );

  new k8s.apps.v1.DaemonSet(
    name,
    {
      metadata: { name, namespace: args.namespace, labels },
      spec: {
        selector: { matchLabels: labels },
        template: {
          metadata: { labels },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            securityContext: { runAsNonRoot: true, runAsUser: 10001, runAsGroup: 10001, seccompProfile: { type: 'RuntimeDefault' } },
            containers: [
              {
                name: 'collector',
                image,
                args: ['--config=/conf/config.json'],
                env: [{ name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } }],
                ports: [
                  { name: 'otlp-http', containerPort: otlpPort },
                  { name: 'health', containerPort: healthPort },
                ],
                resources: { requests: { cpu: '50m', memory: '128Mi' }, limits: { memory: '256Mi' } },
                readinessProbe: { httpGet: { path: '/', port: 'health' }, periodSeconds: 5 },
                livenessProbe: { httpGet: { path: '/', port: 'health' }, periodSeconds: 10 },
                securityContext: { allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: { drop: ['ALL'] } },
                volumeMounts: [{ name: 'config', mountPath: '/conf', readOnly: true }],
              },
            ],
            volumes: [{ name: 'config', configMap: { name: config.metadata.name } }],
          },
        },
      },
    },
    opts,
  );

  return new k8s.core.v1.Service(
    name,
    {
      metadata: { name, namespace: args.namespace, labels },
      spec: {
        selector: labels,
        internalTrafficPolicy: 'Local',
        ports: [{ name: 'otlp-http', port: otlpPort, targetPort: 'otlp-http' }],
      },
    },
    opts,
  );
}
