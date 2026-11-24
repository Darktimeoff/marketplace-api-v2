import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SetMetadata } from '@nestjs/common';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { Traced } from '../../../src/generic/telemetry/decorator/traced.decorator.js';

class OrderRepository {
  @Traced()
  async create(fail: boolean): Promise<string> {
    if (fail) {
      throw new Error('duplicate key');
    }

    return trace.getActiveSpan()?.spanContext().spanId ?? 'no span';
  }
}

class OrderPlaceCommandHandler {
  constructor(private readonly orders: OrderRepository) {}

  @Traced()
  async execute(fail = false): Promise<string> {
    return this.orders.create(fail);
  }
}

describe('Traced decorator', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
  const handler = new OrderPlaceCommandHandler(new OrderRepository());

  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(provider);
  });

  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
  });

  beforeEach(() => exporter.reset());

  it('opens a span named Class.method, active inside the method, nested under the caller span', async () => {
    const activeInRepository = await handler.execute();
    const [repository, commandHandler] = exporter.getFinishedSpans();

    expect(commandHandler.name).toBe('OrderPlaceCommandHandler.execute');
    expect(repository.name).toBe('OrderRepository.create');
    expect(repository.spanContext().spanId).toBe(activeInRepository);
    expect(repository.parentSpanContext?.spanId).toBe(commandHandler.spanContext().spanId);
    expect(repository.spanContext().traceId).toBe(commandHandler.spanContext().traceId);
  });

  it('records the error on every span it passes through and rethrows it', async () => {
    await expect(handler.execute(true)).rejects.toThrow('duplicate key');

    for (const span of exporter.getFinishedSpans()) {
      expect(span.status).toEqual({ code: SpanStatusCode.ERROR, message: 'duplicate key' });
      expect(span.events.map(({ name }) => name)).toEqual(['exception']);
    }
  });

  it('keeps the metadata Nest decorators put on the method, such as roles or route options', () => {
    class WithMetadata {
      @Traced()
      @SetMetadata('role', 'admin')
      async run(): Promise<void> {}
    }

    expect(Reflect.getMetadata('role', WithMetadata.prototype.run)).toBe('admin');
    expect(WithMetadata.prototype.run.name).toBe('run');
  });
});
