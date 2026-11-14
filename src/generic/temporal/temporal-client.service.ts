import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client, Connection, type TLSConfig } from '@temporalio/client';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { getTlsOptions } from '../tls/util/get-tls-options.util.js';

@Injectable()
export class TemporalClientService implements OnModuleInit, OnModuleDestroy {
  client: Client;
  private connection: Connection;

  constructor(
    private readonly environment: EnvironmentService,
    private readonly secrets: SecretManagerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.connection = await Connection.connect(await this.connectionOptions());
    this.client = new Client({
      connection: this.connection,
      namespace: this.environment.get('TEMPORAL_NAMESPACE'),
    });
  }

  async connectionOptions(): Promise<{ address: string; tls: false | TLSConfig; apiKey: string | undefined }> {
    const address = this.environment.get('TEMPORAL_ADDRESS');
    const tls = getTlsOptions(this.environment.get('TLS_MODE'), this.environment.get('TLS_CA_PATH'), address.split(':')[0]);

    return {
      address,
      tls: tls ? { serverRootCACertificate: Buffer.from(tls.ca.join('\n')) } : false,
      apiKey: this.environment.get('TEMPORAL_AUTH') === 'api-key' ? await this.secrets.get('TEMPORAL_API_KEY') : undefined,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.close();
  }
}
