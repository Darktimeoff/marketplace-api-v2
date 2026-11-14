import { context, propagation, SpanKind, SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import { keepMethodIdentity } from '../../decorator/util/keep-method-identity.util.js';

const tracer = trace.getTracer('marketplace-api');

type AsyncMethodType = (...args: any[]) => Promise<unknown>;

export interface TracedOptionsInterface<TArgs extends unknown[]> {
  name?: (...args: TArgs) => string;
  kind?: SpanKind;
  parent?: (...args: TArgs) => string | null | undefined;
  attributes?: (...args: TArgs) => Attributes;
}

export function Traced<K extends AsyncMethodType, TArgs extends Parameters<K> = Parameters<K>>(
  options: TracedOptionsInterface<TArgs> = {},
): (target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<K>) => void {
  return (target, propertyKey, descriptor) => {
    const original = descriptor.value as unknown as AsyncMethodType;
    const defaultName = `${target.constructor.name}.${String(propertyKey)}`;

    function traced(this: unknown, ...args: TArgs): Promise<unknown> {
      const traceparent = options.parent?.(...args);
      const parentContext = traceparent ? propagation.extract(context.active(), { traceparent }) : context.active();
      const spanOptions = { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes?.(...args) };

      return tracer.startActiveSpan(options.name?.(...args) ?? defaultName, spanOptions, parentContext, async (span) => {
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
    descriptor.value = traced as unknown as K;
  };
}
