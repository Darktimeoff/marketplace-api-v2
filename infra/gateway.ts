import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

const namespace = 'envoy-gateway-system';
const chart = 'oci://docker.io/envoyproxy/gateway-helm';
const chartVersion = 'v1.9.3';

export function envoyGateway(opts: pulumi.CustomResourceOptions): k8s.helm.v3.Release {
  return new k8s.helm.v3.Release(
    'envoy-gateway',
    { name: 'envoy-gateway', chart, version: chartVersion, namespace, createNamespace: true, atomic: true, timeout: 300 },
    opts,
  );
}
