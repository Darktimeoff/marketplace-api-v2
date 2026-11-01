// TODO(hw-26): remove after homework
import { spawn, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';
import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { createStorageClient } from '../generic/storage/create-storage-client.js';
import { requiredEnvironment, storageClientOptionsFromEnvironment } from '../generic/storage/storage-environment.js';

const children: ChildProcess[] = [];
const results: Record<string, number> = {};

process.on('exit', () => {
  for (const child of children) {
    child.kill('SIGKILL');
  }
});

export function storage(): { client: S3Client; bucket: string } {
  return { client: createStorageClient(storageClientOptionsFromEnvironment()), bucket: requiredEnvironment('STORAGE_BUCKET') };
}

export function directObjectUrl(key: string): string {
  const bucket = requiredEnvironment('STORAGE_BUCKET');
  const endpoint = process.env.STORAGE_ENDPOINT;
  return endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.${process.env.STORAGE_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

export function note(message: string): void {
  console.log(`# ${message}`);
}

export function report(key: string, value: number): void {
  results[key] = value;
  console.log(`${key}=${value}`);
}

export function verify(expected: Record<string, number | ((value: number) => boolean)>): void {
  const broken = Object.entries(expected).filter(([key, rule]) => {
    const value = results[key];
    return value === undefined || (typeof rule === 'function' ? !rule(value) : value !== rule);
  });

  if (broken.length > 0) {
    console.error(`# invariant broken: ${broken.map(([key]) => `${key}=${results[key]}`).join(', ')}`);
    process.exit(1);
  }

  note('all invariants hold');
}

export function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitFor(check: () => Promise<boolean>, what: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`timed out waiting for ${what}`);
}

export async function startProcess(script: string, port: number, environment: NodeJS.ProcessEnv): Promise<ChildProcess> {
  if (await isPortOpen(port)) {
    throw new Error(`port ${port} is busy; stop whatever listens there and rerun the demo`);
  }

  const child = spawn(process.execPath, [script], { env: { ...process.env, ...environment }, stdio: 'ignore' });
  children.push(child);
  await waitFor(() => isPortOpen(port), `${script} on :${port}`);
  return child;
}

export async function stopProcess(child: ChildProcess, port: number): Promise<void> {
  child.kill('SIGTERM');
  await waitFor(async () => !(await isPortOpen(port)), `:${port} to close`, 20_000);
}

export async function startApi(port: number): Promise<ChildProcess> {
  const api = await startProcess('dist/main.js', port, { PORT: String(port) });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/health`).catch(() => null))?.ok === true, `API health on :${port}`);
  return api;
}

export async function demoToken(api: string, email: string): Promise<string> {
  const credentials = { email, password: 'demo-password-hw26' };
  await fetch(`${api}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: email, password: credentials.password }),
  });

  if (!login.ok) {
    throw new Error(`demo login failed: ${login.status}`);
  }

  return ((await login.json()) as { accessToken: string }).accessToken;
}

export function identityOf(token: string): string {
  return (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sub: string }).sub;
}

export async function deletePrefix(client: S3Client, bucket: string, prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;

  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key! }));

    if (keys.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
      deleted += keys.length;
    }

    token = page.NextContinuationToken;
  } while (token);

  return deleted;
}

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
