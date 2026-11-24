import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsMiddleware } from './metrics.middleware.js';
import { MetricsService } from './metrics.service.js';
import { MetricsServerService } from './metrics-server.service.js';

@Module({
  providers: [MetricsService, MetricsServerService],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
