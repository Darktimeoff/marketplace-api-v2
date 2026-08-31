import { Module } from '@nestjs/common';
import { EnvironmentModule } from './generic/environment/environment.module.js';
import { DBModule } from './generic/db/db.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [EnvironmentModule, DBModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
