import { NoopSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace';

export const serviceName = process.env.OTEL_SERVICE_NAME || 'marketplace-api';

let processor: SpanProcessor = new NoopSpanProcessor();

export function exportSpansWith(registered: SpanProcessor): void {
  processor = registered;
}

export const exportedSpans: SpanProcessor = {
  onStart: () => undefined,
  onEnd: span => processor.onEnd(span),
  forceFlush: () => processor.forceFlush(),
  shutdown: async () => undefined,
};
