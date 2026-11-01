// TODO(hw-26): remove after homework
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { HeadObjectCommand, NotFound, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createStorageClient } from './generic/storage/create-storage-client.js';
import { requiredEnvironment, storageClientOptionsFromEnvironment } from './generic/storage/storage-environment.js';

const ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

async function exists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error instanceof NotFound) {
      return false;
    }

    throw error;
  }
}

async function publish(client: S3Client, bucket: string, file: string): Promise<string> {
  const content = await readFile(file);
  const extension = extname(file);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
  const key = `assets/${basename(file, extension)}.${hash}${extension}`;

  if (await exists(client, bucket, key)) {
    console.log(`${file} → ${key} (unchanged)`);
    return key;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: ASSET_CONTENT_TYPES[extension] ?? 'application/octet-stream',
      CacheControl: ASSET_CACHE_CONTROL,
    }),
  );
  console.log(`${file} → ${key} (uploaded)`);
  return key;
}

async function main(): Promise<void> {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error('usage: node dist/asset-publish.js <file...>');
    process.exit(1);
  }

  const client = createStorageClient(storageClientOptionsFromEnvironment());
  const bucket = requiredEnvironment('STORAGE_BUCKET');
  const manifest: Record<string, string> = {};

  for (const file of files) {
    manifest[basename(file)] = await publish(client, bucket, file);
  }

  console.log(JSON.stringify(manifest));
  client.destroy();
}

void main();
