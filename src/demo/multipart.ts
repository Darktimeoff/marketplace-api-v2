// TODO(hw-26): remove after homework
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AbortMultipartUploadCommand, HeadObjectCommand, ListMultipartUploadsCommand, NotFound, type S3Client } from '@aws-sdk/client-s3';
import { deletePrefix, demoToken, identityOf, json, note, report, startApi, stopProcess, storage, verify } from './demo-support.js';

const PORT = 3103;
const FILE_SIZE = 11 * 1024 * 1024;

async function abortUnfinished(client: S3Client, bucket: string, prefix: string): Promise<number> {
  const uploads = (await client.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix }))).Uploads ?? [];

  for (const upload of uploads) {
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: upload.Key, UploadId: upload.UploadId }));
  }

  return uploads.length;
}

async function headStatus(client: S3Client, bucket: string, key: string): Promise<[number, number, string]> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return [200, head.ContentLength ?? 0, head.ETag ?? ''];
  } catch (error) {
    if (error instanceof NotFound) {
      return [404, 0, ''];
    }

    throw error;
  }
}

function runUploader(api: string, token: string, mediaId: string, file: string, crashAfter?: number): { exitCode: number | null; sent: number } {
  const args = ['dist/demo/multipart-uploader.js', api, token, mediaId, file, ...(crashAfter ? [String(crashAfter)] : [])];
  const child = spawnSync(process.execPath, args, { encoding: 'utf8', env: { PATH: process.env.PATH } });
  process.stdout.write(child.stdout);
  process.stderr.write(child.stderr);
  return { exitCode: child.status, sent: Number(/^sent=(\d+)$/m.exec(child.stdout)?.[1] ?? -1) };
}

async function main(): Promise<void> {
  const { client, bucket } = storage();
  const workDir = await mkdtemp(join(tmpdir(), 'demo-multipart-'));
  const file = join(workDir, 'video.mp4');
  const bytes = randomBytes(FILE_SIZE);
  await writeFile(file, bytes);

  const api = await startApi(PORT);
  const base = `http://127.0.0.1:${PORT}`;
  const token = await demoToken(base, 'demo-multipart@example.com');
  const prefix = `media/${identityOf(token)}/`;
  note(`cleanup: aborted ${await abortUnfinished(client, bucket, prefix)} unfinished uploads, removed ${await deletePrefix(client, bucket, prefix)} objects`);

  const intent = await fetch(`${base}/media/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ mimeType: 'video/mp4', sizeBytes: FILE_SIZE }),
  });
  const upload = await json<{ id: string; partSize: number; partCount: number }>(intent);
  note(`intent ${intent.status}: ${FILE_SIZE} bytes as ${upload.partCount} parts of ${upload.partSize}`);

  const first = runUploader(base, token, upload.id, file, 2);
  note(`process A exited with ${first.exitCode}`);

  const key = (await (await fetch(`${base}/media/${upload.id}/parts`, { headers: { authorization: `Bearer ${token}` } })).json()) as { parts: { url: string }[] };
  const objectKey = decodeURIComponent(new URL(key.parts[0].url).pathname).replace(`/${bucket}/`, '');
  report('head-before-complete', (await headStatus(client, bucket, objectKey))[0]);

  const second = runUploader(base, token, upload.id, file);
  report('resumed-parts', second.sent);

  report('complete', (await fetch(`${base}/media/${upload.id}/complete`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })).status);
  const [, size, etag] = await headStatus(client, bucket, objectKey);
  const md5 = createHash('md5').update(bytes).digest('hex');
  note(`object ETag=${etag}, md5(file)=${md5}`);
  report('size-match', size === FILE_SIZE ? 1 : 0);
  report('etag-multipart', new RegExp(`-${upload.partCount}"?$`).test(etag) && !etag.includes(md5) ? 1 : 0);

  await stopProcess(api, PORT);
  await rm(workDir, { recursive: true, force: true });
  client.destroy();
  verify({
    'head-before-complete': 404,
    'resumed-parts': 1,
    complete: 200,
    'size-match': 1,
    'etag-multipart': 1,
  });
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
