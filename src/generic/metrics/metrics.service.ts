import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly requests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests by method, route template and status code',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  private readonly duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration by method and route template',
    labelNames: ['method', 'route'],
    registers: [this.registry],
  });

  record(method: string, route: string, status: number, seconds: number): void {
    this.requests.inc({ method, route, status: String(status) });
    this.duration.observe({ method, route }, seconds);
  }
}
