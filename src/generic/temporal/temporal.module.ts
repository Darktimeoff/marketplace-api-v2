import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { TemporalClientService } from './temporal-client.service.js';

@Module({
  imports: [SecretManagerModule],
  providers: [TemporalClientService],
  exports: [TemporalClientService],
})
export class TemporalModule {}
