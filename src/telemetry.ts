import { register } from 'node:module';
import type { IncomingMessage } from 'node:http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { BatchSpanProcessor, NoopSpanProcessor } from '@opentelemetry/sdk-trace';
import { exportSpansWith, serviceName } from './generic/telemetry/span-export.js';

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

process.env.OTEL_METRICS_EXPORTER ??= 'none';
process.env.OTEL_LOGS_EXPORTER ??= 'none';

const untracedPaths = ['/healthz', '/readyz', '/metrics'];
const nestVersions = ['>=4.0.0 <13'];

function isUntraced(request: IncomingMessage): boolean {
  return untracedPaths.includes((request.url ?? '').split('?')[0]);
}

class Nest12Instrumentation extends NestInstrumentation {
  override init() {
    const module = super.init();
    module.supportedVersions = nestVersions;

    for (const file of module.files) {
      file.supportedVersions = nestVersions;
    }

    return module;
  }
}

const spanProcessors = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? [new BatchSpanProcessor({ exporter: new OTLPTraceExporter(), scheduledDelayMillis: Number(process.env.OTEL_BSP_SCHEDULE_DELAY) || undefined })]
  : [new NoopSpanProcessor()];

spanProcessors.forEach(exportSpansWith);

export const telemetry = new NodeSDK({
  serviceName,
  spanProcessors,
  instrumentations: [
    new HttpInstrumentation({ ignoreIncomingRequestHook: isUntraced }),
    new ExpressInstrumentation({ ignoreLayersType: [ExpressLayerType.MIDDLEWARE], ignoreLayers: [/\*splat/] }),
    new Nest12Instrumentation(),
    new PgInstrumentation({ requireParentSpan: true }),
    new IORedisInstrumentation({ requireParentSpan: true }),
    new AmqplibInstrumentation(),
  ],
});

telemetry.start();
