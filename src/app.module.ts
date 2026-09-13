import { Module } from '@nestjs/common';
import { EnvironmentModule } from './generic/environment/environment.module.js';
import { DBModule } from './generic/db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { OrderModule } from './order/order.module.js';

@Module({
  imports: [EnvironmentModule, DBModule, HealthModule, OrderModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
