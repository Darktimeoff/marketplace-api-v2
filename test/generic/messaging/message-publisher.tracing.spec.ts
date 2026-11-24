import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { context, propagation, SpanKind, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { MessagePublisherService } from '../../../src/generic/messaging/message-publisher.service.js';
import { MessageBrokerEnum } from '../../../src/generic/messaging/enum/message-broker.enum.js';
import type { EventPublisherInterface } from '../../../src/generic/messaging/interface/event-publisher.interface.js';
import type { JobPublisherInterface } from '../../../src/generic/messaging/interface/job-publisher.interface.js';

describe('MessagePublisherService tracing', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
  const requestTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  const requestSpanId = '00f067aa0ba902b7';
  const message = {
    specversion: '1.0',
    id: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
    source: '/order-service',
    type: 'order.created',
    time: '2026-11-14T10:00:00.000Z',
    datacontenttype: 'application/json',
    subject: 'order-1',
    data: {},
  } as const;

  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(provider);
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });

  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
    propagation.disable();
    context.disable();
  });

  beforeEach(() => exporter.reset());

  function aPublisher() {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    return { events, publisher: new MessagePublisherService(events as unknown as EventPublisherInterface, { publish: vi.fn() } as unknown as JobPublisherInterface) };
  }

  it('publishes inside a producer span that continues the trace stored with the outbox row, and sends that span on', async () => {
    const { events, publisher } = aPublisher();

    await publisher.publish(MessageBrokerEnum.KAFKA, 'order.events', { ...message, traceparent: `00-${requestTraceId}-${requestSpanId}-01` });

    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe('publish order.events');
    expect(span.kind).toBe(SpanKind.PRODUCER);
    expect(span.spanContext().traceId).toBe(requestTraceId);
    expect(span.parentSpanContext?.spanId).toBe(requestSpanId);
    expect(events.publish.mock.calls[0][1].traceparent).toBe(`00-${requestTraceId}-${span.spanContext().spanId}-01`);
  });

  it('starts a trace of its own for a row written outside any request', async () => {
    const { events, publisher } = aPublisher();

    await publisher.publish(MessageBrokerEnum.KAFKA, 'order.events', message);

    const [span] = exporter.getFinishedSpans();
    expect(span.parentSpanContext).toBeUndefined();
    expect(events.publish.mock.calls[0][1].traceparent).toBe(`00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`);
  });
});
