// TODO(hw-26): remove after homework
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deletePrefix, directObjectUrl, note, report, startProcess, stopProcess, storage, verify } from './demo-support.js';

const ORIGIN_PORT = Number(process.env.EDGE_ORIGIN_PORT || 8787);
const EDGE_URL = process.env.MEDIA_PUBLIC_BASE_URL || 'http://localhost:8088';
const ASSET_NAME = 'demo-app';

function publish(file: string): string {
  const child = spawnSync(process.execPath, ['dist/asset-publish.js', file], { encoding: 'utf8' });

  if (child.status !== 0) {
    throw new Error(`asset-publish failed: ${child.stderr}`);
  }

  const manifest = JSON.parse(child.stdout.trim().split('\n').at(-1)!) as Record<string, string>;
  note(child.stdout.trim().split('\n')[0]);
  return manifest[`${ASSET_NAME}.css`];
}

async function edge(key: string): Promise<[number, string, string]> {
  const response = await fetch(`${EDGE_URL}/${key}`);
  return [response.status, response.headers.get('x-cache') ?? '', await response.text()];
}

async function main(): Promise<void> {
  const { client, bucket } = storage();
  note(`cleanup: removed ${await deletePrefix(client, bucket, `assets/${ASSET_NAME}.`)} previous demo assets`);
  const origin = await startProcess('dist/edge.js', ORIGIN_PORT, {});

  const workDir = await mkdtemp(join(tmpdir(), 'demo-cdn-'));
  const file = join(workDir, `${ASSET_NAME}.css`);
  const run = Date.now().toString(36);
  const v1 = `/* build ${run}-1 */ body { color: #222; }\n`;
  const v2 = `/* build ${run}-2 */ body { color: #c00; }\n`;

  await writeFile(file, v1);
  const firstKey = publish(file);

  report('direct', (await fetch(directObjectUrl(firstKey))).status);

  const [missStatus, missCache, firstBody] = await edge(firstKey);
  note(`first edge request X-Cache=${missCache}`);
  report('edge-miss', missStatus === 200 && missCache === 'MISS' ? 200 : 0);
  const [hitStatus, hitCache] = await edge(firstKey);
  note(`second edge request X-Cache=${hitCache}`);
  report('edge-hit', hitStatus);
  report('cache-hit', hitCache === 'HIT' ? 1 : 0);

  await writeFile(file, v2);
  const secondKey = publish(file);
  report('new-name', secondKey !== firstKey ? 1 : 0);
  const [newStatus, , secondBody] = await edge(secondKey);
  report('new-url', newStatus);
  report('content-changed', secondBody === v2 && secondBody !== firstBody ? 1 : 0);
  const [oldStatus, oldCache, oldBody] = await edge(firstKey);
  note(`old URL still served: ${oldStatus} X-Cache=${oldCache} unchanged=${oldBody === v1}`);
  report('invalidations', 0);

  await stopProcess(origin, ORIGIN_PORT);
  await rm(workDir, { recursive: true, force: true });
  client.destroy();
  verify({
    direct: 403,
    'edge-miss': 200,
    'edge-hit': 200,
    'cache-hit': 1,
    'new-name': 1,
    'new-url': 200,
    'content-changed': 1,
  });
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
