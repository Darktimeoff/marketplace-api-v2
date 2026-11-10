import { Module } from '@nestjs/common';
import { EnvironmentModule } from './generic/environment/environment.module.js';
import { SecretManagerModule } from './generic/secret-manager/secret-manager.module.js';
import { PostgresOptionsService } from './generic/db/postgres-options.service.js';

@Module({
  imports: [EnvironmentModule, SecretManagerModule],
  providers: [PostgresOptionsService],
})
export class MigrateModule {}
