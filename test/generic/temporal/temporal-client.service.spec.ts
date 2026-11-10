import { describe, expect, it } from 'vitest';
import { rootCertificates } from 'node:tls';
import { TemporalClientService } from '../../../src/generic/temporal/temporal-client.service.js';
import type { EnvironmentService } from '../../../src/generic/environment/environment.module.js';
import type { SecretManagerService } from '../../../src/generic/secret-manager/secret-manager.service.js';

describe('TemporalClientService connection options', () => {
  function aService(settings: Record<string, string>) {
    const environment = { get: (key: string) => settings[key] } as unknown as EnvironmentService;
    const secrets = { get: async (name: string) => `${name} from the vault` } as unknown as SecretManagerService;

    return new TemporalClientService(environment, secrets);
  }

  it('connects in plain text without a key locally', async () => {
    const options = await aService({ TEMPORAL_ADDRESS: 'temporal:7233', TLS_MODE: 'disable', TLS_CA_PATH: '', TEMPORAL_AUTH: 'none' }).connectionOptions();

    expect(options).toEqual({ address: 'temporal:7233', tls: false, apiKey: undefined });
  });

  it('uses TLS with the trusted CAs and the API key from the vault for Temporal Cloud', async () => {
    const options = await aService({
      TEMPORAL_ADDRESS: 'marketplace.a1b2c.tmprl.cloud:7233',
      TLS_MODE: 'verify-full',
      TLS_CA_PATH: '',
      TEMPORAL_AUTH: 'api-key',
    }).connectionOptions();

    expect(options.apiKey).toBe('TEMPORAL_API_KEY from the vault');
    expect(options.tls && options.tls.serverRootCACertificate?.toString()).toBe(rootCertificates.join('\n'));
  });
});
