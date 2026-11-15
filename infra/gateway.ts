import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

const controllerNamespace = 'envoy-gateway-system';
const chart = 'oci://docker.io/envoyproxy/gateway-helm';
const chartVersion = 'v1.9.3';
const className = 'envoy';
const httpsPort = 443;
const hstsMaxAgeSeconds = 31536000;

export interface GatewayArgsInterface {
  namespace: pulumi.Input<string>;
  name: string;
  nodePort: number;
  tlsSecretName: string;
  service: k8s.core.v1.Service;
}

export function envoyGateway(opts: pulumi.CustomResourceOptions): k8s.helm.v3.Release {
  return new k8s.helm.v3.Release(
    'envoy-gateway',
    { name: 'envoy-gateway', chart, version: chartVersion, namespace: controllerNamespace, createNamespace: true, atomic: true, timeout: 300 },
    opts,
  );
}

export function apiGateway(args: GatewayArgsInterface, controller: k8s.helm.v3.Release, opts: pulumi.CustomResourceOptions): void {
  const proxy = new k8s.apiextensions.CustomResource(
    className,
    {
      apiVersion: 'gateway.envoyproxy.io/v1alpha1',
      kind: 'EnvoyProxy',
      metadata: { name: className, namespace: controllerNamespace },
      spec: {
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

  new k8s.apiextensions.CustomResource(
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
}
