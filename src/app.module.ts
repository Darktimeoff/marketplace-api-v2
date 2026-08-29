import { Module } from '@nestjs/common';
import { ConfigEnvironmentModule } from './generic/config/config-environment.module.js';
import { DBModule } from './generic/db/db.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [ConfigEnvironmentModule, DBModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
