import { Module, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EnvironmentModule } from './generic/environment/environment.module.js';
import { DBModule } from './generic/db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { OrderModule } from './order/order.module.js';
import { ValidationResponseInterceptor } from './generic/validation/validation-response.interceptor.js';

@Module({
  imports: [EnvironmentModule, DBModule, HealthModule, OrderModule],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe({ transform: true, whitelist: true }),
    },
    { provide: APP_INTERCEPTOR, useClass: ValidationResponseInterceptor },
  ],
})
export class AppModule {}