// TODO(hw-29): remove after homework
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { build, buyer, logLines, newTraceparent, placeOrder, report, startApp, stockedOffer, stopApp } from './lib/app.mjs';

const burstSize = 8;

build();
const offer = await stockedOffer();
const app = await startApp(join(mkdtempSync(join(tmpdir(), 'demo-logs-')), 'app.log'));

try {
  const token = await buyer(app, offer);

  const single = newTraceparent();
  await (await placeOrder(app, token, offer, { traceparent: single.header })).arrayBuffer();

  const burst = Array.from({ length: burstSize }, newTraceparent);
  await Promise.all(burst.map(async ({ header }) => (await placeOrder(app, token, offer, { traceparent: header })).arrayBuffer()));

  const tokenMarker = `TOKEN-MARKER-${randomBytes(8).toString('hex')}`;
  const passwordMarker = `PASSWORD-MARKER-${randomBytes(8).toString('hex')}`;
  const secretRequests = [newTraceparent(), newTraceparent()];
  await (await fetch(`${app.url}/auth/me`, { headers: { authorization: `Bearer ${tokenMarker}`, traceparent: secretRequests[0].header } })).arrayBuffer();
  await (await fetch(`${app.url}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', traceparent: secretRequests[1].header },
    body: JSON.stringify({ login: 'nobody@example.com', password: passwordMarker }),
  })).arrayBuffer();

  await stopApp(app);

  const raw = logLines(app);
  const parsed = [];
  let nonJson = 0;

  for (const line of raw) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      nonJson++;
    }
  }

  const singleLines = parsed.filter((line) => line.trace_id === single.traceId);
  const singleTraceIds = new Set(singleLines.map((line) => line.trace_id));
  const layers = new Set(singleLines.map((line) => line.layer).filter(Boolean));

  const groups = burst.map(({ traceId }) => parsed.filter((line) => line.trace_id === traceId).length);
  const burstTraceIds = groups.filter((size) => size > 0).length;

  const secretIds = new Set(secretRequests.map(({ traceId }) => traceId));
  const secretRequestsLogged = secretRequests.every(({ traceId }) => parsed.some((line) => line.trace_id === traceId));
  const secretInLogs = raw.filter((line) => line.includes(tokenMarker) || line.includes(passwordMarker)).length;

  const values = {
    'non-json-lines': nonJson,
    'request-lines': singleLines.length,
    layers: layers.size,
    'distinct-trace-ids': singleTraceIds.size,
    'trace-id-matches-header': Number(singleTraceIds.size === 1 && singleTraceIds.has(single.traceId)),
    burst: burst.length,
    'burst-trace-ids': burstTraceIds,
    'burst-uneven': Math.max(...groups) - Math.min(...groups),
    'secret-req-logged': Number(secretRequestsLogged && secretIds.size === 2),
    'secret-in-logs': secretInLogs,
  };

  report(values, [
    ['non-json-lines=0', values['non-json-lines'] === 0],
    ['layers>=3', values.layers >= 3],
    ['distinct-trace-ids=1', values['distinct-trace-ids'] === 1],
    ['trace-id-matches-header=1', values['trace-id-matches-header'] === 1],
    ['burst>=8', values.burst >= 8],
    ['burst-trace-ids=burst', values['burst-trace-ids'] === values.burst],
    ['burst-uneven=0', values['burst-uneven'] === 0],
    ['secret-req-logged=1', values['secret-req-logged'] === 1],
    ['secret-in-logs=0', values['secret-in-logs'] === 0],
  ]);
} finally {
  await stopApp(app);
}
