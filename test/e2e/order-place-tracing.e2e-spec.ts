import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { Client, Connection } from '@temporalio/client';
import { OpenTelemetryPlugin, type OpenTelemetryPluginOptions } from '@temporalio/interceptors-opentelemetry-v2';
import { NativeConnection, Worker } from '@temporalio/worker';
import type { OrderPlaceActivitiesInterface } from '../../src/order/workflow/order-place-workflow.interface.js';

describe('Order place saga tracing', () => {
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor({ exporter });
  const provider = new TracerProvider({ spanProcessors: [processor] });
  let plugin: OpenTelemetryPlugin;
  const workflowsPath = fileURLToPath(new URL('../../src/order/workflow/order-place.workflow.ts', import.meta.url));
  const done = async () => undefined;
  const activities: OrderPlaceActivitiesInterface = { reserveStock: done, releaseStock: done, chargeCustomer: done, refundCustomer: done, markPaid: done, markFailed: done };

  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(provider);
    plugin = new OpenTelemetryPlugin({ resource: resourceFromAttributes({ 'service.name': 'marketplace-api' }), spanProcessor: processor } as unknown as OpenTelemetryPluginOptions);
  });

  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
  });

  function spanCounts(): Record<string, number> {
    return exporter.getFinishedSpans().reduce<Record<string, number>>((counts, { name }) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }), {});
  }

  it('exports every workflow span once although a worker without a cache replays the history on every task, as after a restart', async () => {
    const address = process.env.TEMPORAL_ADDRESS as string;
    const taskQueue = `order-place-tracing-${randomUUID()}`;
    const workerConnection = await NativeConnection.connect({ address });
    const clientConnection = await Connection.connect({ address });
    const worker = await Worker.create({ connection: workerConnection, taskQueue, workflowsPath, activities, plugins: [plugin], maxCachedWorkflows: 0 });
    const client = new Client({ connection: clientConnection, plugins: [plugin] });
    const workflowId = `order-place-${randomUUID()}`;
    const input = { orderPublicId: randomUUID(), buyerPublicId: randomUUID(), totalAmount: '160.00', items: [] };

    const history = await worker.runUntil(async () => {
      const handle = await client.workflow.start('orderPlaceWorkflow', { taskQueue, workflowId, args: [input] });

      expect(await handle.result()).toBe('paid');

      return handle.fetchHistory();
    });
    const liveSpans = spanCounts();

    exporter.reset();
    await Worker.runReplayHistory({ workflowsPath, plugins: [plugin] }, history, workflowId);
    const replaySpans = exporter.getFinishedSpans();

    await clientConnection.close();
    await workerConnection.close();

    expect(history.events?.filter(event => event.workflowTaskCompletedEventAttributes).length).toBeGreaterThan(1);
    expect(liveSpans).toMatchObject({
      'StartWorkflow:orderPlaceWorkflow': 1,
      'RunWorkflow:orderPlaceWorkflow': 1,
      'StartActivity:reserveStock': 1,
      'RunActivity:reserveStock': 1,
      'StartActivity:chargeCustomer': 1,
      'RunActivity:chargeCustomer': 1,
      'StartActivity:markPaid': 1,
      'RunActivity:markPaid': 1,
    });
    expect(replaySpans).toEqual([]);
  });
});
