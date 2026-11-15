import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

const namespace = 'cert-manager';
const chart = 'oci://quay.io/jetstack/charts/cert-manager';
const chartVersion = 'v1.21.3';
const issuerName = 'local-ca';
const caSecretName = 'local-ca';

export interface TlsArgsInterface {
  caDir: string;
  namespace: pulumi.Input<string>;
  secretName: string;
  dnsNames: string[];
}

function readCa(caDir: string): { crt: string; key: string } {
  const crt = resolve(caDir, 'ca.crt');
  const key = resolve(caDir, 'ca.key');

  if (!existsSync(crt) || !existsSync(key)) {
    throw new pulumi.RunError(`Local CA not found in ${caDir}: run bash scripts/bootstrap-tls.sh`);
  }

  return { crt: readFileSync(crt, 'utf8'), key: readFileSync(key, 'utf8') };
}

export function tls(args: TlsArgsInterface, opts: pulumi.CustomResourceOptions): k8s.apiextensions.CustomResource {
  const ca = readCa(args.caDir);

  const certManager = new k8s.helm.v3.Release(
    'cert-manager',
    { name: 'cert-manager', chart, version: chartVersion, namespace, createNamespace: true, atomic: true, timeout: 300, values: { crds: { enabled: true } } },
    opts,
  );

  const caSecret = new k8s.core.v1.Secret(
    caSecretName,
    {
      metadata: { name: caSecretName, namespace: certManager.status.namespace.apply(value => value ?? namespace) },
      type: 'kubernetes.io/tls',
      stringData: { 'tls.crt': ca.crt, 'tls.key': pulumi.secret(ca.key) },
    },
    { ...opts, additionalSecretOutputs: ['stringData', 'data'] },
  );

  const issuer = new k8s.apiextensions.CustomResource(
    issuerName,
    { apiVersion: 'cert-manager.io/v1', kind: 'ClusterIssuer', metadata: { name: issuerName }, spec: { ca: { secretName: caSecret.metadata.name } } },
    { ...opts, dependsOn: [certManager] },
  );

  return new k8s.apiextensions.CustomResource(
    args.secretName,
    {
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: { name: args.secretName, namespace: args.namespace },
      spec: {
        secretName: args.secretName,
        dnsNames: args.dnsNames,
        privateKey: { algorithm: 'ECDSA', size: 256, rotationPolicy: 'Always' },
        duration: '2160h',
        renewBefore: '720h',
        issuerRef: { kind: 'ClusterIssuer', name: issuer.metadata.name },
      },
    },
    { ...opts, dependsOn: [issuer] },
  );
}
