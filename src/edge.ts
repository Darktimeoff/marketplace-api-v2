import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Readable } from 'node:stream';
import { GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { createStorageClient } from './generic/storage/create-storage-client.js';
import { requiredEnvironment, storageClientOptionsFromEnvironment } from './generic/storage/storage-environment.js';
import { MEDIA_UPLOAD_TYPES } from './media/constant/media-upload.constant.js';

const PUBLIC_PREFIXES = ['media/'];

const client = createStorageClient(storageClientOptionsFromEnvironment());
const bucket = requiredEnvironment('STORAGE_BUCKET');
const port = Number(process.env.EDGE_ORIGIN_PORT || 8787);

function isPublicKey(key: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix)) && !key.split('/').includes('..');
}

function safetyHeaders(contentType: string): Record<string, string> {
  if (contentType in MEDIA_UPLOAD_TYPES) {
    return { 'content-type': contentType, 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" };
  }

  return {
    'content-type': 'application/octet-stream',
    'content-disposition': 'attachment',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
  };
}

async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const key = decodeURIComponent(new URL(request.url ?? '/', 'http://edge').pathname.slice(1));

  if ((request.method !== 'GET' && request.method !== 'HEAD') || !isPublicKey(key)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    response.writeHead(200, {
      ...safetyHeaders(object.ContentType ?? 'application/octet-stream'),
      'content-length': object.ContentLength,
      ...(object.CacheControl ? { 'cache-control': object.CacheControl } : {}),
      ...(object.ETag ? { etag: object.ETag } : {}),
      ...(object.LastModified ? { 'last-modified': object.LastModified.toUTCString() } : {}),
    });
    console.log(`origin ${request.method} ${key} → 200 cache-control=${object.CacheControl ?? '(none)'}`);

    if (request.method === 'HEAD') {
      (object.Body as Readable).destroy();
      response.end();
      return;
    }

    (object.Body as Readable).pipe(response);
  } catch (error) {
    if (error instanceof NoSuchKey) {
      console.log(`origin ${request.method} ${key} → 404`);
      response.writeHead(404).end();
      return;
    }

    console.error(`origin ${request.method} ${key} → 502`, error);
    response.writeHead(502).end();
  }
}

createServer((request, response) => void serve(request, response)).listen(port, () => {
  console.log(`edge origin listening on :${port}, bucket ${bucket}`);
});
