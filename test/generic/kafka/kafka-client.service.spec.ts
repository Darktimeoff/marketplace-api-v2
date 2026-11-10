import { describe, expect, it } from 'vitest';
import { rootCertificates } from 'node:tls';
import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { KafkaClientService } from '../../../src/generic/kafka/kafka-client.service.js';
import type { EnvironmentService } from '../../../src/generic/environment/environment.module.js';
import type { SecretManagerService } from '../../../src/generic/secret-manager/secret-manager.service.js';

interface KafkaClientInternalsInterface {
  sasl(): Promise<KafkaJS.SASLOptions | undefined>;
  toConfig(brokers: string[], tls: unknown, sasl: KafkaJS.SASLOptions | undefined): KafkaJS.CommonConstructorConfig;
}

describe('KafkaClientService config', () => {
  async function configOf(settings: Record<string, string>): Promise<KafkaJS.CommonConstructorConfig> {
    const environment = { get: (key: string) => settings[key] } as unknown as EnvironmentService;
    const secrets = { get: async (name: string) => `${name} from the vault` } as unknown as SecretManagerService;
    const service = new KafkaClientService(environment, secrets) as unknown as KafkaClientInternalsInterface;
    const tls = settings.TLS_MODE === 'verify-full' ? { rejectUnauthorized: true, ca: [...rootCertificates], checkServerIdentity: () => undefined } : false;

    return service.toConfig(settings.KAFKA_BROKERS.split(','), tls, await service.sasl());
  }

  it('talks plain text without SASL locally, with no sasl key at all, which the client would read as configured', async () => {
    const config = await configOf({ KAFKA_BROKERS: 'kafka:29092', TLS_MODE: 'disable', KAFKA_SASL_MECHANISM: 'none' });

    expect(config.kafkaJS).toMatchObject({ brokers: ['kafka:29092'], ssl: false });
    expect(config.kafkaJS).not.toHaveProperty('sasl');
    expect(config).not.toHaveProperty('ssl.ca.pem');
  });

  it('turns on TLS with hostname verification and the trusted CAs, and SASL with credentials from the vault', async () => {
    const config = await configOf({ KAFKA_BROKERS: 'b-1.msk:9096', TLS_MODE: 'verify-full', KAFKA_SASL_MECHANISM: 'scram-sha-512' });

    expect(config.kafkaJS).toMatchObject({
      brokers: ['b-1.msk:9096'],
      ssl: true,
      sasl: { mechanism: 'scram-sha-512', username: 'KAFKA_SASL_USERNAME from the vault', password: 'KAFKA_SASL_PASSWORD from the vault' },
    });
    expect(config['ssl.endpoint.identification.algorithm']).toBe('https');
    expect(config['ssl.ca.pem']).toBe(rootCertificates.join('\n'));
  });
});
