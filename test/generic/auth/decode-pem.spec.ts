import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { decodePem } from '../../../src/generic/auth/decode-pem.js';

describe('decodePem', () => {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });

  it('keeps a PEM as it is', () => {
    expect(decodePem(publicKey)).toBe(publicKey);
  });

  it('decodes a base64 PEM, so a key survives a single-line export', () => {
    expect(decodePem(Buffer.from(publicKey).toString('base64'))).toBe(publicKey);
  });
});
