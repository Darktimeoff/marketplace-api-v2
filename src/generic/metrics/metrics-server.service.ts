import { createServer, type Server } from 'node:http';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.module.js';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsServerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsServerService.name);
  private readonly path = '/metrics';
  private server?: Server;

  constructor(
    private readonly metrics: MetricsService,
    private readonly environment: EnvironmentService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const port = this.environment.get('METRICS_PORT');

    this.server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url?.split('?')[0] !== this.path) {
        response.writeHead(404).end();
        return;
      }

      this.metrics.registry.metrics().then(
        (body) => response.writeHead(200, { 'content-type': this.metrics.registry.contentType }).end(body),
        () => response.writeHead(500).end(),
      );
    });

    await new Promise<void>((resolve) => this.server!.listen(port, resolve));
    this.logger.log(`serving ${this.path} on internal port ${port}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await new Promise((resolve) => this.server?.close(resolve) ?? resolve(undefined));
  }
}
