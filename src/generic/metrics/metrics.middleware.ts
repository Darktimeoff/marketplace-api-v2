import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly unmatchedRoute = 'unmatched';
  private readonly catchAllRoute = '{/*splat}';

  constructor(private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics.record(request.method, this.routeOf(request), response.statusCode, seconds);
    });

    next();
  }

  private routeOf(request: Request): string {
    const path: unknown = request.route?.path;

    return typeof path === 'string' && path !== this.catchAllRoute ? path : this.unmatchedRoute;
  }
}
