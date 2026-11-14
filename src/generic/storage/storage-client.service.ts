import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { createStorageClient } from './create-storage-client.js';

@Injectable()
export class StorageClientService implements OnModuleInit, OnModuleDestroy {
  client: S3Client;
  readonly bucket: string;

  constructor(
    private readonly secrets: SecretManagerService,
    private readonly environment: EnvironmentService,
  ) {
    this.bucket = this.environment.get('STORAGE_BUCKET');
  }

  async onModuleInit(): Promise<void> {
    const usesKeys = this.environment.get('STORAGE_AUTH') === 'keys';

    this.client = createStorageClient({
      region: this.environment.get('STORAGE_REGION'),
      endpoint: this.environment.get('STORAGE_ENDPOINT'),
      accessKeyId: usesKeys ? await this.secrets.get('STORAGE_ACCESS_KEY') : undefined,
      secretAccessKey: usesKeys ? await this.secrets.get('STORAGE_SECRET_KEY') : undefined,
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
