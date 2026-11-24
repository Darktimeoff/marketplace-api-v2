// TODO(hw-29): remove after homework
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { build, buyer, logLines, placeOrder, report, startApp, stockedOffer, stopApp } from './lib/app.mjs';

const traceApi = process.env.TRACE_API_URL;
const pollTimeoutMs = 30000;

function toHex(id) {
  return /^[0-9a-f]+$/i.test(id) ? id.toLowerCase() : Buffer.from(id, 'base64').toString('hex');
}

async function fetchSpans(traceId) {
  const response = await fetch(`${traceApi}/api/v2/traces/${traceId}`).catch(() => null);

  if (!response?.ok) {
    return [];
  }

  const { trace } = await response.json();

  return (trace?.resourceSpans ?? []).flatMap((resource) =>
    resource.scopeSpans.flatMap((scope) =>
      scope.spans.map((span) => ({
        scope: scope.scope?.name ?? '',
        name: span.name,
        traceId: toHex(span.traceId),
        spanId: toHex(span.spanId),
        parentSpanId: span.parentSpanId ? toHex(span.parentSpanId) : '',
        kind: span.kind,
        status: span.status?.code,
      })),
    ),
  );
}

async function waitForSpans(traceId) {
  const deadline = Date.now() + pollTimeoutMs;
  let spans = [];
  let stablePolls = 0;

  while (Date.now() < deadline) {
    const latest = await fetchSpans(traceId);
    stablePolls = latest.length > 0 && latest.length === spans.length ? stablePolls + 1 : 0;
    spans = latest;

    if (stablePolls >= 2) {
      return spans;
    }

    await sleep(1000);
  }

  return spans;
}

function isError(status) {
  return status === 2 || status === 'STATUS_CODE_ERROR';
}

if (!traceApi) {
  throw new Error('TRACE_API_URL is not set: it comes from .env through scripts/with-secrets.sh, or export it');
}

build();
const offer = await stockedOffer();
const app = await startApp(join(mkdtempSync(join(tmpdir(), 'demo-trace-')), 'app.log'), { OTEL_BSP_SCHEDULE_DELAY: '500' });
let status;
const traceId = randomBytes(16).toString('hex');
const parentSpanId = randomBytes(8).toString('hex');
const idempotencyKey = randomUUID();

try {
  const token = await buyer(app, offer);
  const response = await placeOrder(app, token, offer, {
    traceparent: `00-${traceId}-${parentSpanId}-01`,
    'idempotency-key': idempotencyKey,
    'x-demo-fail': '1',
  });
  await response.arrayBuffer();
  status = response.status;
} finally {
  await stopApp(app);
}

const spans = await waitForSpans(traceId);
const spanIds = new Set(spans.map((span) => span.spanId));
const orphans = spans.filter((span) => span.parentSpanId && span.parentSpanId !== parentSpanId && !spanIds.has(span.parentSpanId));
const serverSpan = spans.find((span) => span.scope.includes('instrumentation-http') && (span.kind === 2 || span.kind === 'SPAN_KIND_SERVER'));
const spanTraceIds = new Set(spans.map((span) => span.traceId));
const requestLines = logLines(app).map((line) => JSON.parse(line)).filter((line) => line.idempotencyKey === idempotencyKey);
const logTraceIds = new Set(requestLines.map((line) => line.trace_id));

const values = {
  'response-status': status,
  spans: spans.length,
  'orphan-spans': orphans.length,
  'controller-span': Number(spans.some((span) => span.name === 'OrderController.create')),
  'trace-matches-header': Number(spanTraceIds.size === 1 && spanTraceIds.has(traceId)),
  'log-lines': requestLines.length,
  'trace-matches-log': Number(requestLines.length > 0 && logTraceIds.size === 1 && spanTraceIds.size === 1 && logTraceIds.has([...spanTraceIds][0])),
  'span-status-error': Number(Boolean(serverSpan) && isError(serverSpan.status)),
};

report(values, [
  ['spans>=2', values.spans >= 2],
  ['orphan-spans=0', values['orphan-spans'] === 0],
  ['trace-matches-header=1', values['trace-matches-header'] === 1],
  ['trace-matches-log=1', values['trace-matches-log'] === 1],
  ['span-status-error=1', values['span-status-error'] === 1],
]);
