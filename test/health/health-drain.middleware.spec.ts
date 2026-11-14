import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HealthDrainMiddleware } from '../../src/health/health-drain.middleware.js';
import type { HealthShutdownService } from '../../src/health/health-shutdown.service.js';

describe('HealthDrainMiddleware', () => {
  function aResponse() {
    return { setHeader: vi.fn() } as unknown as ServerResponse & { setHeader: ReturnType<typeof vi.fn> };
  }

  function aMiddleware(draining: boolean) {
    return new HealthDrainMiddleware({ isDraining: () => draining } as unknown as HealthShutdownService);
  }

  it('leaves keep-alive alone while the instance serves normally', () => {
    const response = aResponse();
    const next = vi.fn();

    aMiddleware(false).use({} as IncomingMessage, response, next);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('asks the client to close the connection after this response during the drain', () => {
    const response = aResponse();
    const next = vi.fn();

    aMiddleware(true).use({} as IncomingMessage, response, next);

    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'close');
    expect(next).toHaveBeenCalledOnce();
  });
});
