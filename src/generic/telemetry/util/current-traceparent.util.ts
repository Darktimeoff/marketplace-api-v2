import { context, propagation } from '@opentelemetry/api';

export function currentTraceparent(): string | null {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  return carrier.traceparent ?? null;
}
