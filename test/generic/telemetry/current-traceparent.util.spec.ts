import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { currentTraceparent } from '../../../src/generic/telemetry/util/current-traceparent.util.js';

describe('currentTraceparent', () => {
  const provider = new TracerProvider();

  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(provider);
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });

  afterAll(() => {
    trace.disable();
    propagation.disable();
    context.disable();
  });

  it('is the W3C traceparent of the active span', () => {
    provider.getTracer('test').startActiveSpan('POST /order', (span) => {
      const { traceId, spanId } = span.spanContext();

      expect(currentTraceparent()).toBe(`00-${traceId}-${spanId}-01`);
      span.end();
    });
  });

  it('is null outside a trace, where a relay or a cron runs', () => {
    expect(currentTraceparent()).toBeNull();
  });
});
