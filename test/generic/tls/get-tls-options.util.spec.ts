import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates, type PeerCertificate } from 'node:tls';
import { getTlsOptions } from '../../../src/generic/tls/util/get-tls-options.util.js';

describe('getTlsOptions', () => {
  let workDir: string;
  let caPath: string;
  let certificate: PeerCertificate;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tls-options-'));
    caPath = join(workDir, 'ca.crt');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
      '-subj', '/CN=db', '-addext', 'subjectAltName=DNS:db-bouncer,IP:10.0.0.5',
      '-keyout', join(workDir, 'key.pem'), '-out', caPath,
    ], { stdio: 'ignore' });
    const x509 = new X509Certificate(await readFile(caPath));
    certificate = { subject: { CN: 'db' }, subjectaltname: x509.subjectAltName } as unknown as PeerCertificate;
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  function identityError(host: string, connectedAs: string) {
    const tls = getTlsOptions('verify-full', caPath, host);

    if (!tls || !tls.checkServerIdentity) {
      throw new Error('verify-full returned no identity check');
    }

    return tls.checkServerIdentity(connectedAs, certificate);
  }

  it('talks plain text when the mode is unset or disable, as compose and the tests do', () => {
    expect(getTlsOptions(undefined, undefined, 'db-bouncer')).toBe(false);
    expect(getTlsOptions('disable', caPath, 'db-bouncer')).toBe(false);
  });

  it('trusts the system CAs plus the extra bundle, so one setting fits public and private CAs', async () => {
    const tls = getTlsOptions('verify-full', caPath, 'db-bouncer');

    expect(tls).toMatchObject({ rejectUnauthorized: true });
    expect(tls && tls.ca).toEqual([...rootCertificates, await readFile(caPath, 'utf8')]);
  });

  it('trusts only the system CAs without a bundle', () => {
    const tls = getTlsOptions('verify-full', '', 'db-bouncer');

    expect(tls && tls.ca).toEqual([...rootCertificates]);
  });

  it('checks the certificate against the configured host, a name or an IP, not the name the socket reports', () => {
    expect(identityError('db-bouncer', 'localhost')).toBeUndefined();
    expect(identityError('10.0.0.5', 'localhost')).toBeUndefined();
    expect(identityError('10.0.0.6', 'localhost')?.message).toContain("IP: 10.0.0.6 is not in the cert's list");
    expect(identityError('db.example.com', 'db-bouncer')?.message).toContain("Host: db.example.com. is not in the cert's altnames");
  });

  it('refuses a mode that would encrypt without checking who answers', () => {
    expect(() => getTlsOptions('require', caPath, 'db-bouncer')).toThrow('TLS_MODE must be disable or verify-full, got require');
  });
});
