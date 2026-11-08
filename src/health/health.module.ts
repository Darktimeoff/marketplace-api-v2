import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { HealthShutdownService } from './health-shutdown.service.js';
import { HealthDrainMiddleware } from './health-drain.middleware.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthShutdownService],
  exports: [HealthShutdownService],
})
export class HealthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HealthDrainMiddleware).forRoutes('*splat');
  }
}
