import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { StorageClientService } from './storage-client.service.js';

@Module({
  imports: [SecretManagerModule],
  providers: [StorageClientService],
  exports: [StorageClientService],
})
export class StorageModule {}
