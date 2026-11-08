import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HealthShutdownService } from './health-shutdown.service.js';

@Injectable()
export class HealthDrainMiddleware implements NestMiddleware {
  constructor(private readonly shutdown: HealthShutdownService) {}

  use(_request: IncomingMessage, response: ServerResponse, next: () => void): void {
    if (this.shutdown.isDraining()) {
      response.setHeader('Connection', 'close');
    }

    next();
  }
}
