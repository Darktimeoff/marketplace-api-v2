import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { RedisClientService } from './redis-client.service.js';

@Module({
  imports: [SecretManagerModule],
  providers: [RedisClientService],
  exports: [RedisClientService],
})
export class RedisModule {}
