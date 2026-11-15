import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

type PeerType = k8s.types.input.networking.v1.NetworkPolicyPeer;
type PortType = k8s.types.input.networking.v1.NetworkPolicyPort;

const privateRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const apiServerServiceCidr = '10.96.0.1/32';
const gatewayNamespace = 'envoy-gateway-system';
const gatewayProxy: PeerType = {
  namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': gatewayNamespace } },
  podSelector: { matchLabels: { 'app.kubernetes.io/component': 'proxy' } },
};
const gatewayController: PeerType = {
  namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': gatewayNamespace } },
  podSelector: { matchLabels: { 'app.kubernetes.io/name': 'gateway-helm' } },
};

const dependencyPorts = [
  5432, // db-bouncer
  5672, // rabbitmq
  5671, // rabbitmq with TLS
  29092, // kafka, internal listener
  7233, // temporal
  6379, // redis-cache, redis-queue
  9000, // minio
  8080, // infisical-backend
];
const backendPorts = [
  4318, // tempo, OTLP
  3100, // loki
  9090, // prometheus, remote write
];

export interface NetworkPoliciesArgsInterface {
  namespace: pulumi.Input<string>;
  observabilityNamespace: pulumi.Input<string>;
  dependenciesCidr: string;
  observabilityCidr: string;
  apiServerCidr: string;
}

type PolicySpecType = k8s.types.input.networking.v1.NetworkPolicySpec;

const dnsEgress = {
  to: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } } }],
  ports: [
    { protocol: 'UDP', port: 53 },
    { protocol: 'TCP', port: 53 },
  ],
};

function tcp(...ports: (number | string)[]): PortType[] {
  return ports.map(port => ({ protocol: 'TCP', port }));
}

function cidr(block: string, except?: string[]): PeerType {
  return { ipBlock: { cidr: block, ...(except ? { except } : {}) } };
}

function podsIn(namespace: pulumi.Input<string>, app: string): PeerType {
  return { namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': namespace } }, podSelector: { matchLabels: { app } } };
}

export function networkPolicies(args: NetworkPoliciesArgsInterface, opts: pulumi.CustomResourceOptions): void {
  const policy = (resourceName: string, namespace: pulumi.Input<string>, name: string, spec: PolicySpecType): k8s.networking.v1.NetworkPolicy =>
    new k8s.networking.v1.NetworkPolicy(resourceName, { metadata: { name, namespace }, spec }, opts);
  const api = podsIn(args.namespace, 'marketplace-api');
  const collector = podsIn(args.observabilityNamespace, 'otel-collector');

  for (const [prefix, namespace] of [['', args.namespace], ['observability-', args.observabilityNamespace]] as const) {
    policy(`${prefix}default-deny`, namespace, 'default-deny', { podSelector: {}, policyTypes: ['Ingress', 'Egress'] });
    policy(`${prefix}allow-dns`, namespace, 'allow-dns', { podSelector: {}, policyTypes: ['Egress'], egress: [dnsEgress] });
  }

  policy('marketplace-api', args.namespace, 'marketplace-api', {
    podSelector: { matchLabels: { app: 'marketplace-api' } },
    policyTypes: ['Ingress', 'Egress'],
    ingress: [{ from: [gatewayProxy], ports: tcp('http') }, { from: [collector], ports: tcp('metrics') }],
    egress: [
      { to: [cidr(args.dependenciesCidr)], ports: tcp(...dependencyPorts) },
      { to: [collector], ports: tcp(4318) },
      { to: [cidr('0.0.0.0/0', privateRanges)], ports: tcp(443) },
    ],
  });

  policy('marketplace-api-migrate', args.namespace, 'marketplace-api-migrate', {
    podSelector: { matchLabels: { app: 'marketplace-api-migrate' } },
    policyTypes: ['Ingress', 'Egress'],
    egress: [{ to: [cidr(args.dependenciesCidr)], ports: tcp(5432, 8080) }],
  });

  policy('envoy-proxy', gatewayNamespace, 'envoy-proxy', {
    podSelector: { matchLabels: { 'app.kubernetes.io/component': 'proxy' } },
    policyTypes: ['Ingress', 'Egress'],
    ingress: [{ ports: tcp(10443, 19003) }],
    egress: [{ to: [api], ports: tcp(3000) }, { to: [gatewayController], ports: tcp(18000, 18001, 18002) }, { to: [collector], ports: tcp(4317) }, dnsEgress],
  });

  policy('otel-collector', args.observabilityNamespace, 'otel-collector', {
    podSelector: { matchLabels: { app: 'otel-collector' } },
    policyTypes: ['Ingress', 'Egress'],
    ingress: [{ from: [api], ports: tcp('otlp-http') }, { from: [gatewayProxy], ports: tcp('otlp-grpc') }, { ports: tcp('health') }],
    egress: [
      { to: [cidr(args.observabilityCidr)], ports: tcp(...backendPorts) },
      { to: [api], ports: tcp(9464) },
      { to: [cidr(args.apiServerCidr), cidr(apiServerServiceCidr)], ports: tcp(6443, 443) },
    ],
  });
}
