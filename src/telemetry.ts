import { register } from 'node:module';
import type { IncomingMessage } from 'node:http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

process.env.OTEL_METRICS_EXPORTER ??= 'none';
process.env.OTEL_LOGS_EXPORTER ??= 'none';

const untracedPaths = ['/healthz', '/readyz', '/metrics'];

function isUntraced(request: IncomingMessage): boolean {
  return untracedPaths.includes((request.url ?? '').split('?')[0]);
}

export const telemetry = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'marketplace-api',
  ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? { traceExporter: new OTLPTraceExporter() } : { spanProcessors: [] }),
  instrumentations: [
    new HttpInstrumentation({ ignoreIncomingRequestHook: isUntraced }),
    new ExpressInstrumentation({ ignoreLayersType: [ExpressLayerType.MIDDLEWARE] }),
    new PgInstrumentation({ requireParentSpan: true }),
    new IORedisInstrumentation({ requireParentSpan: true }),
    new AmqplibInstrumentation(),
  ],
});

telemetry.start();
