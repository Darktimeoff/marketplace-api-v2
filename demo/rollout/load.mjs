// TODO(hw-28): remove after homework
import { existsSync } from 'node:fs';

const url = process.env.LOAD_URL;
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 16);
const stopFile = process.env.LOAD_STOP_FILE;
const minRequests = Number(process.env.LOAD_MIN_REQUESTS ?? 5000);
const timeoutMs = Number(process.env.LOAD_TIMEOUT_MS ?? 2000);

let ok = 0;
let failed = 0;
const reasons = new Map();

function fail(reason) {
  failed += 1;
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
}

function stopped() {
  return ok + failed >= minRequests && existsSync(stopFile);
}

async function worker() {
  while (!stopped()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      await response.arrayBuffer();
      if (response.ok) {
        ok += 1;
      } else {
        fail(`http ${response.status}`);
      }
    } catch (error) {
      fail(error.cause?.code ?? error.name ?? 'error');
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.log(JSON.stringify({ requests: ok + failed, ok, failed, reasons: Object.fromEntries(reasons) }));
