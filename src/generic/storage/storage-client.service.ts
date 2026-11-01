import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';

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
    const endpoint = this.environment.get('STORAGE_ENDPOINT') || undefined;

    this.client = new S3Client({
      region: this.environment.get('STORAGE_REGION'),
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: await this.secrets.get('STORAGE_ACCESS_KEY'),
        secretAccessKey: await this.secrets.get('STORAGE_SECRET_KEY'),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
