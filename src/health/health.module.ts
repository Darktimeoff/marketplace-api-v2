import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { HealthShutdownService } from './health-shutdown.service.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthShutdownService],
  exports: [HealthShutdownService],
})
export class HealthModule {}
