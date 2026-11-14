import { describe, expect, it, vi } from 'vitest';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace';
import { exportedSpans, exportSpansWith } from '../../../src/generic/telemetry/span-export.js';

describe('span export', () => {
  const workflowSpan = { name: 'RunWorkflow:orderPlaceWorkflow' } as ReadableSpan;

  it('drops spans until telemetry registers the processor, as in tests where the SDK never starts', async () => {
    expect(() => exportedSpans.onEnd(workflowSpan)).not.toThrow();
    await expect(exportedSpans.forceFlush()).resolves.toBeUndefined();
  });

  it('hands spans from the workflow sandbox to the processor the SDK exports with, and leaves its shutdown to the SDK', async () => {
    const processor = { onStart: vi.fn(), onEnd: vi.fn(), forceFlush: vi.fn(async () => undefined), shutdown: vi.fn(async () => undefined) } satisfies SpanProcessor;

    exportSpansWith(processor);
    exportedSpans.onEnd(workflowSpan);
    await exportedSpans.forceFlush();
    await exportedSpans.shutdown();

    expect(processor.onEnd).toHaveBeenCalledWith(workflowSpan);
    expect(processor.forceFlush).toHaveBeenCalledOnce();
    expect(processor.shutdown).not.toHaveBeenCalled();
  });
});
