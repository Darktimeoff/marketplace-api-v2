import { S3Client } from '@aws-sdk/client-s3';
import type { StorageClientOptionsInterface } from './storage-client-options.interface.js';

export function createStorageClient(options: StorageClientOptionsInterface): S3Client {
  const endpoint = options.endpoint || undefined;

  return new S3Client({
    region: options.region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}
