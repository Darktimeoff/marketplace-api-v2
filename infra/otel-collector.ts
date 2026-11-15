import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

const name = 'otel-collector';
const labels = { app: name };
const image = 'otel/opentelemetry-collector-contrib:0.164.0@sha256:340c9ca6a36617084c6661bdc4f0fe92b7cda5a805d61673ec8db375fddc522b';
const otlpPort = 4318;
const otlpGrpcPort = 4317;
const healthPort = 13133;
const podLogsPath = '/var/log/pods';
const checkpointsPath = '/var/lib/otelcol/file_storage';
const chownImage = 'busybox:1.37.0@sha256:a7dbc319b1438115a207e11930dc4bb3e643dcb3ec0bdd694bb36cd8fad289ec';
const collectorUser = 10001;
const pinoSeverity = { trace: '10', debug: '20', info: '30', warn: '40', error: '50', fatal: '60' };

export interface OtelCollectorArgsInterface {
  namespace: pulumi.Input<string>;
  appNamespace: pulumi.Input<string>;
  tracesEndpoint: string;
  remoteWriteEndpoint: string;
  logsEndpoint: string;
}

function collectorConfig(appNamespace: string, args: OtelCollectorArgsInterface): string {
  return JSON.stringify({
    extensions: {
      health_check: { endpoint: `0.0.0.0:${healthPort}` },
      file_storage: { directory: checkpointsPath, compaction: { on_start: true, directory: checkpointsPath } },
    },
    receivers: {
      otlp: { protocols: { http: { endpoint: `0.0.0.0:${otlpPort}` }, grpc: { endpoint: `0.0.0.0:${otlpGrpcPort}` } } },
      filelog: {
        include: [`${podLogsPath}/${appNamespace}_marketplace-api-*/api/*.log`],
        start_at: 'beginning',
        storage: 'file_storage',
        include_file_path: true,
        operators: [
          { type: 'container', id: 'cri' },
          { type: 'add', field: 'resource["service.name"]', value: 'marketplace-api' },
          { type: 'json_parser', if: 'body matches "^\\\\{"', parse_from: 'body', parse_to: 'attributes' },
          { type: 'trace_parser', if: 'attributes.trace_id != nil', trace_id: { parse_from: 'attributes.trace_id' } },
          { type: 'severity_parser', if: 'attributes.level != nil', parse_from: 'attributes.level', mapping: pinoSeverity, overwrite_text: true },
          { type: 'time_parser', if: 'attributes.time != nil', parse_from: 'attributes.time', layout_type: 'epoch', layout: 'ms' },
          { type: 'move', if: 'attributes.msg != nil', from: 'attributes.msg', to: 'body' },
          { type: 'remove', if: 'attributes.trace_id != nil', field: 'attributes.trace_id' },
          { type: 'remove', if: 'attributes.level != nil', field: 'attributes.level' },
          { type: 'remove', if: 'attributes.time != nil', field: 'attributes.time' },
          { type: 'remove', if: 'attributes.hostname != nil', field: 'attributes.hostname' },
          { type: 'remove', if: 'attributes.pid != nil', field: 'attributes.pid' },
          { type: 'remove', field: 'attributes.logtag' },
          { type: 'remove', field: 'attributes["log.file.name"]' },
          { type: 'remove', field: 'attributes["log.file.path"]' },
        ],
      },
      prometheus: {
        config: {
          scrape_configs: [
            {
              job_name: 'marketplace-api',
              scrape_interval: '5s',
              kubernetes_sd_configs: [
                { role: 'pod', namespaces: { names: [appNamespace] }, selectors: [{ role: 'pod', field: 'spec.nodeName=${env:NODE_NAME}' }] },
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
      'transform/envoy-access-log': {
        log_statements: [
          {
            conditions: ['resource.attributes["service.name"] == "envoy-gateway"'],
            statements: [
              'set(log.body, Concat([log.attributes["method"], log.attributes["path"], log.attributes["status"]], " "))',
              'set(log.severity_number, SEVERITY_NUMBER_INFO)',
              'set(log.severity_number, SEVERITY_NUMBER_WARN) where Int(log.attributes["status"]) >= 400',
              'set(log.severity_number, SEVERITY_NUMBER_ERROR) where Int(log.attributes["status"]) >= 500',
              'set(log.severity_text, "INFO") where log.severity_number == SEVERITY_NUMBER_INFO',
              'set(log.severity_text, "WARN") where log.severity_number == SEVERITY_NUMBER_WARN',
              'set(log.severity_text, "ERROR") where log.severity_number == SEVERITY_NUMBER_ERROR',
            ],
          },
        ],
      },
    },
    exporters: {
      'otlp_http/tempo': { endpoint: args.tracesEndpoint, tls: { insecure: true } },
      'otlp_http/loki': { endpoint: args.logsEndpoint, tls: { insecure: true } },
      prometheus_remote_write: { endpoint: args.remoteWriteEndpoint, tls: { insecure: true } },
    },
    service: {
      extensions: ['health_check', 'file_storage'],
      pipelines: {
        traces: { receivers: ['otlp'], processors: ['memory_limiter', 'batch'], exporters: ['otlp_http/tempo'] },
        logs: { receivers: ['filelog', 'otlp'], processors: ['memory_limiter', 'transform/envoy-access-log', 'batch'], exporters: ['otlp_http/loki'] },
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
      metadata: { name, namespace: args.appNamespace },
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] }],
    },
    opts,
  );

  new k8s.rbac.v1.RoleBinding(
    name,
    {
      metadata: { name, namespace: args.appNamespace },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: role.metadata.name },
      subjects: [{ kind: 'ServiceAccount', name: serviceAccount.metadata.name, namespace: args.namespace }],
    },
    opts,
  );

  const config = new k8s.core.v1.ConfigMap(
    name,
    {
      metadata: { name, namespace: args.namespace },
      data: { 'config.json': pulumi.output(args.appNamespace).apply(appNamespace => collectorConfig(appNamespace, args)) },
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
            securityContext: { seccompProfile: { type: 'RuntimeDefault' } },
            initContainers: [
              {
                name: 'own-checkpoints',
                image: chownImage,
                command: ['chown', `${collectorUser}:0`, checkpointsPath],
                securityContext: {
                  runAsUser: 0,
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                  capabilities: { drop: ['ALL'], add: ['CHOWN'] },
                },
                volumeMounts: [{ name: 'checkpoints', mountPath: checkpointsPath }],
              },
            ],
            containers: [
              {
                name: 'collector',
                image,
                args: ['--config=/conf/config.json'],
                env: [{ name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } }],
                ports: [
                  { name: 'otlp-http', containerPort: otlpPort },
                  { name: 'otlp-grpc', containerPort: otlpGrpcPort },
                  { name: 'health', containerPort: healthPort },
                ],
                resources: { requests: { cpu: '50m', memory: '128Mi' }, limits: { memory: '256Mi' } },
                readinessProbe: { httpGet: { path: '/', port: 'health' }, periodSeconds: 5 },
                livenessProbe: { httpGet: { path: '/', port: 'health' }, periodSeconds: 10 },
                securityContext: {
                  runAsNonRoot: true,
                  runAsUser: collectorUser,
                  runAsGroup: 0,
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                  capabilities: { drop: ['ALL'] },
                },
                volumeMounts: [
                  { name: 'config', mountPath: '/conf', readOnly: true },
                  { name: 'pod-logs', mountPath: podLogsPath, readOnly: true },
                  { name: 'checkpoints', mountPath: checkpointsPath },
                ],
              },
            ],
            volumes: [
              { name: 'config', configMap: { name: config.metadata.name } },
              { name: 'pod-logs', hostPath: { path: podLogsPath, type: 'Directory' } },
              { name: 'checkpoints', hostPath: { path: checkpointsPath, type: 'DirectoryOrCreate' } },
            ],
          },
        },
      },
    },
    { ...opts, deleteBeforeReplace: true },
  );

  return new k8s.core.v1.Service(
    name,
    {
      metadata: { name, namespace: args.namespace, labels },
      spec: {
        selector: labels,
        internalTrafficPolicy: 'Local',
        ports: [
          { name: 'otlp-http', port: otlpPort, targetPort: 'otlp-http' },
          { name: 'otlp-grpc', port: otlpGrpcPort, targetPort: 'otlp-grpc' },
        ],
      },
    },
    opts,
  );
}
