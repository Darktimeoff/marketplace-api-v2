import { readFileSync } from 'node:fs';
import { checkServerIdentity, rootCertificates, type ConnectionOptions } from 'node:tls';

export function getTlsOptions(mode: string | undefined, caPath: string | undefined, host: string): false | VerifiedTlsOptionsInterface {
  if (!mode || mode === 'disable') {
    return false;
  }

  if (mode !== 'verify-full') {
    throw new Error(`TLS_MODE must be disable or verify-full, got ${mode}`);
  }

  return {
    rejectUnauthorized: true,
    ca: caPath ? [...rootCertificates, readFileSync(caPath, 'utf8')] : [...rootCertificates],
    checkServerIdentity: (_servername, certificate) => checkServerIdentity(host, certificate),
  };
}

export interface VerifiedTlsOptionsInterface {
  rejectUnauthorized: true;
  ca: string[];
  checkServerIdentity: NonNullable<ConnectionOptions['checkServerIdentity']>;
}
