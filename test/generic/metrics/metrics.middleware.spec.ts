import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { MetricsMiddleware } from '../../../src/generic/metrics/metrics.middleware.js';
import { MetricsService } from '../../../src/generic/metrics/metrics.service.js';

describe('MetricsMiddleware', () => {
  function handle(metrics: MetricsService, method: string, route: string | undefined, statusCode: number): void {
    const response = Object.assign(new EventEmitter(), { statusCode });
    const request = { method, route: route === undefined ? undefined : { path: route } };
    new MetricsMiddleware(metrics).use(request as unknown as Request, response as unknown as Response, (() => undefined) as NextFunction);
    response.emit('finish');
  }

  async function counterSeries(metrics: MetricsService): Promise<string[]> {
    return (await metrics.registry.metrics()).split('\n').filter((line) => line.startsWith('http_requests_total{'));
  }

  it('labels a request with its route template, so a hundred ids add no series', async () => {
    const metrics = new MetricsService();

    for (let id = 0; id < 100; id++) {
      handle(metrics, 'GET', '/order/:id', 200);
    }

    expect(await counterSeries(metrics)).toEqual(['http_requests_total{method="GET",route="/order/:id",status="200"} 100']);
  });

  it('puts every request that matched no route under one value', async () => {
    const metrics = new MetricsService();

    handle(metrics, 'GET', undefined, 404);
    handle(metrics, 'GET', '{/*splat}', 404);

    expect(await counterSeries(metrics)).toEqual(['http_requests_total{method="GET",route="unmatched",status="404"} 2']);
  });

  it('counts the status code of the response, observed when the response finishes', async () => {
    const metrics = new MetricsService();

    handle(metrics, 'POST', '/order', 500);

    expect(await counterSeries(metrics)).toEqual(['http_requests_total{method="POST",route="/order",status="500"} 1']);
    expect(await metrics.registry.metrics()).toContain('http_request_duration_seconds_count{method="POST",route="/order"} 1');
  });
});
