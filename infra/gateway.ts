import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

const controllerNamespace = 'envoy-gateway-system';
const chart = 'oci://docker.io/envoyproxy/gateway-helm';
const chartVersion = 'v1.9.3';
const className = 'envoy';
const httpsPort = 443;
const hstsMaxAgeSeconds = 31536000;
const collectorService = 'otel-collector';
const collectorGrpcPort = 4317;
const proxyServiceName = 'envoy-gateway';
const everyClient = { sourceCIDR: { type: 'Distinct', value: '0.0.0.0/0' } };
const rateLimits = [
  { clientSelectors: [everyClient], limit: { requests: 50, unit: 'Second' } },
  { clientSelectors: [{ ...everyClient, path: { type: 'PathPrefix', value: '/auth/' } }], limit: { requests: 20, unit: 'Minute' } },
];
const accessLogFields = {
  method: '%REQ(:METHOD)%',
  path: '%PATH(NQ)%',
  status: '%RESPONSE_CODE%',
  flags: '%RESPONSE_FLAGS%',
  duration_ms: '%DURATION%',
  bytes_sent: '%BYTES_SENT%',
  protocol: '%PROTOCOL%',
  client: '%DOWNSTREAM_REMOTE_ADDRESS_WITHOUT_PORT%',
  upstream: '%UPSTREAM_HOST%',
  route: '%ROUTE_NAME%',
  request_id: '%REQ(X-REQUEST-ID)%',
};

export interface GatewayArgsInterface {
  namespace: pulumi.Input<string>;
  collectorNamespace: pulumi.Input<string>;
  name: string;
  nodePort: number;
  tlsSecretName: string;
  service: k8s.core.v1.Service;
}

export function envoyGateway(opts: pulumi.CustomResourceOptions): k8s.helm.v3.Release {
  return new k8s.helm.v3.Release(
    'envoy-gateway',
    {
      name: 'envoy-gateway',
      chart,
      version: chartVersion,
      namespace: controllerNamespace,
      createNamespace: true,
      atomic: true,
      timeout: 300,
      values: { config: { envoyGateway: { extensionApis: { enableBackend: true } } } },
    },
    opts,
  );
}

export function apiGateway(args: GatewayArgsInterface, controller: k8s.helm.v3.Release, opts: pulumi.CustomResourceOptions): void {
  const collector = new k8s.apiextensions.CustomResource(
    collectorService,
    {
      apiVersion: 'gateway.envoyproxy.io/v1alpha1',
      kind: 'Backend',
      metadata: { name: collectorService, namespace: args.namespace },
      spec: { endpoints: [{ fqdn: { hostname: pulumi.interpolate`${collectorService}.${args.collectorNamespace}.svc.cluster.local`, port: collectorGrpcPort } }] },
    },
    { ...opts, dependsOn: [controller] },
  );
  const collectorRefs = [{ group: 'gateway.envoyproxy.io', kind: 'Backend', name: collector.metadata.name, namespace: args.namespace }];

  const proxy = new k8s.apiextensions.CustomResource(
    className,
    {
      apiVersion: 'gateway.envoyproxy.io/v1alpha1',
      kind: 'EnvoyProxy',
      metadata: { name: className, namespace: controllerNamespace },
      spec: {
        telemetry: {
          tracing: {
            samplingRate: 100,
            provider: { type: 'OpenTelemetry', serviceName: proxyServiceName, backendRefs: collectorRefs },
          },
          accessLog: {
            settings: [
              {
                format: { type: 'JSON', json: accessLogFields },
                sinks: [{ type: 'OpenTelemetry', openTelemetry: { backendRefs: collectorRefs, resources: { 'service.name': proxyServiceName } } }],
              },
            ],
          },
        },
        provider: {
          type: 'Kubernetes',
          kubernetes: {
            envoyService: { type: 'NodePort', patch: { type: 'StrategicMerge', value: { spec: { ports: [{ port: httpsPort, nodePort: args.nodePort }] } } } },
          },
        },
      },
    },
    { ...opts, dependsOn: [controller] },
  );

  const gatewayClass = new k8s.apiextensions.CustomResource(
    className,
    {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'GatewayClass',
      metadata: { name: className },
      spec: {
        controllerName: 'gateway.envoyproxy.io/gatewayclass-controller',
        parametersRef: { group: 'gateway.envoyproxy.io', kind: 'EnvoyProxy', name: proxy.metadata.name, namespace: controllerNamespace },
      },
    },
    { ...opts, dependsOn: [controller] },
  );

  const gateway = new k8s.apiextensions.CustomResource(
    args.name,
    {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'Gateway',
      metadata: { name: args.name, namespace: args.namespace },
      spec: {
        gatewayClassName: gatewayClass.metadata.name,
        listeners: [{ name: 'https', protocol: 'HTTPS', port: httpsPort, tls: { mode: 'Terminate', certificateRefs: [{ kind: 'Secret', name: args.tlsSecretName }] } }],
      },
    },
    opts,
  );

  const route = new k8s.apiextensions.CustomResource(
    args.name,
    {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: { name: args.name, namespace: args.namespace },
      spec: {
        parentRefs: [{ name: gateway.metadata.name }],
        rules: [
          {
            matches: [{ path: { type: 'PathPrefix', value: '/' } }],
            filters: [{ type: 'ResponseHeaderModifier', responseHeaderModifier: { set: [{ name: 'Strict-Transport-Security', value: `max-age=${hstsMaxAgeSeconds}` }] } }],
            backendRefs: [{ name: args.service.metadata.name, port: 80 }],
          },
        ],
      },
    },
    opts,
  );

  new k8s.apiextensions.CustomResource(
    `${args.name}-rate-limit`,
    {
      apiVersion: 'gateway.envoyproxy.io/v1alpha1',
      kind: 'BackendTrafficPolicy',
      metadata: { name: `${args.name}-rate-limit`, namespace: args.namespace },
      spec: {
        targetRefs: [{ group: 'gateway.networking.k8s.io', kind: 'HTTPRoute', name: route.metadata.name }],
        rateLimit: { type: 'Local', local: { rules: rateLimits } },
      },
    },
    opts,
  );
}
