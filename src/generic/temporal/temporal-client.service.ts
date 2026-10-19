import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { EnvironmentService } from '../environment/environment.module.js';

@Injectable()
export class TemporalClientService implements OnModuleInit, OnModuleDestroy {
  client: Client;
  private connection: Connection;

  constructor(private readonly environment: EnvironmentService) {}

  async onModuleInit(): Promise<void> {
    this.connection = await Connection.connect({ address: this.environment.get('TEMPORAL_ADDRESS') });
    this.client = new Client({
      connection: this.connection,
      namespace: this.environment.get('TEMPORAL_NAMESPACE'),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.close();
  }
}
