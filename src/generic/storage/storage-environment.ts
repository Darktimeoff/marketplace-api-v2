import type { StorageClientOptionsInterface } from './storage-client-options.interface.js';

export function requiredEnvironment(name: string): string {
  const value = process.env[name];

  if (!value) {
    console.error(`${name} is not set; run through scripts/with-secrets.sh or export it with SKIP_VAULT=1`);
    process.exit(1);
  }

  return value;
}

export function storageClientOptionsFromEnvironment(): StorageClientOptionsInterface {
  return {
    region: process.env.STORAGE_REGION || 'us-east-1',
    endpoint: process.env.STORAGE_ENDPOINT ?? '',
    accessKeyId: requiredEnvironment('STORAGE_ACCESS_KEY'),
    secretAccessKey: requiredEnvironment('STORAGE_SECRET_KEY'),
  };
}
