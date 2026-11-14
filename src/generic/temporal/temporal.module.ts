import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { TemporalClientService } from './temporal-client.service.js';
import { TemporalRuntimeService } from './temporal-runtime.service.js';

@Module({
  imports: [SecretManagerModule],
  providers: [TemporalRuntimeService, TemporalClientService],
  exports: [TemporalClientService],
})
export class TemporalModule {}
