import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

type PeerType = k8s.types.input.networking.v1.NetworkPolicyPeer;
type PortType = k8s.types.input.networking.v1.NetworkPolicyPort;

const privateRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const apiServerServiceCidr = '10.96.0.1/32';

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
  dependenciesCidr: string;
  observabilityCidr: string;
  apiServerCidr: string;
}

function tcp(...ports: (number | string)[]): PortType[] {
  return ports.map(port => ({ protocol: 'TCP', port }));
}

function pods(app: string): PeerType {
  return { podSelector: { matchLabels: { app } } };
}

function cidr(block: string, except?: string[]): PeerType {
  return { ipBlock: { cidr: block, ...(except ? { except } : {}) } };
}

export function networkPolicies(args: NetworkPoliciesArgsInterface, opts: pulumi.CustomResourceOptions): void {
  const policy = (name: string, spec: k8s.types.input.networking.v1.NetworkPolicySpec): k8s.networking.v1.NetworkPolicy =>
    new k8s.networking.v1.NetworkPolicy(name, { metadata: { name, namespace: args.namespace }, spec }, opts);

  policy('default-deny', { podSelector: {}, policyTypes: ['Ingress', 'Egress'] });

  policy('allow-dns', {
    podSelector: {},
    policyTypes: ['Egress'],
    egress: [
      {
        to: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } } }],
        ports: [
          { protocol: 'UDP', port: 53 },
          { protocol: 'TCP', port: 53 },
        ],
      },
    ],
  });

  policy('marketplace-api', {
    podSelector: { matchLabels: { app: 'marketplace-api' } },
    policyTypes: ['Ingress', 'Egress'],
    ingress: [{ ports: tcp('http') }, { from: [pods('otel-collector')], ports: tcp('metrics') }],
    egress: [
      { to: [cidr(args.dependenciesCidr)], ports: tcp(...dependencyPorts) },
      { to: [pods('otel-collector')], ports: tcp(4318) },
      { to: [cidr('0.0.0.0/0', privateRanges)], ports: tcp(443) },
    ],
  });

  policy('marketplace-api-migrate', {
    podSelector: { matchLabels: { app: 'marketplace-api-migrate' } },
    policyTypes: ['Ingress', 'Egress'],
    egress: [{ to: [cidr(args.dependenciesCidr)], ports: tcp(5432, 8080) }],
  });

  policy('otel-collector', {
    podSelector: { matchLabels: { app: 'otel-collector' } },
    policyTypes: ['Ingress', 'Egress'],
    ingress: [{ from: [pods('marketplace-api')], ports: tcp('otlp-http') }, { ports: tcp('health') }],
    egress: [
      { to: [cidr(args.observabilityCidr)], ports: tcp(...backendPorts) },
      { to: [pods('marketplace-api')], ports: tcp(9464) },
      { to: [cidr(args.apiServerCidr), cidr(apiServerServiceCidr)], ports: tcp(6443, 443) },
    ],
  });
}
