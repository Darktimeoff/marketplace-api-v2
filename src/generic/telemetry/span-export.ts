import { defaultResource, detectResources, envDetector, hostDetector, processDetector, resourceFromAttributes } from '@opentelemetry/resources';
import { NoopSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace';

export const resource = defaultResource()
  .merge(detectResources({ detectors: [envDetector, processDetector, hostDetector] }))
  .merge(resourceFromAttributes({ 'service.name': process.env.OTEL_SERVICE_NAME || 'marketplace-api' }));

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
