import { afterAll, describe, expect, it } from 'vitest';
import { trace } from '@opentelemetry/api';

describe('telemetry without a trace backend', () => {
  let shutdown: () => Promise<void> = async () => undefined;

  afterAll(() => shutdown());

  it('still records spans, so log lines get a trace_id, and only skips the export', async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const { telemetry } = await import('../../../src/telemetry.js');
    shutdown = () => telemetry.shutdown();

    const span = trace.getTracer('probe').startSpan('GET /order');

    expect(span.isRecording()).toBe(true);
    expect(span.spanContext().traceId).not.toBe('00000000000000000000000000000000');
    span.end();
  });
});
