import { SpanStatusCode, trace } from '@opentelemetry/api';
import { keepMethodIdentity } from '../../decorator/util/keep-method-identity.util.js';

const tracer = trace.getTracer('marketplace-api');

export function Traced(): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;
    const spanName = `${target.constructor.name}.${String(propertyKey)}`;

    function traced(this: unknown, ...args: unknown[]): Promise<unknown> {
      return tracer.startActiveSpan(spanName, async (span) => {
        try {
          return await original.apply(this, args);
        } catch (error) {
          span.recordException(error instanceof Error ? error : String(error));
          span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    }

    keepMethodIdentity(original, traced);
    descriptor.value = traced;
  };
}
