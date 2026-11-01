// TODO(hw-26): remove after homework
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { deletePrefix, demoToken, identityOf, isPortOpen, json, note, report, startApi, stopProcess, storage, verify } from './demo-support.js';

const FIRST_PORT = 3101;
const SECOND_PORT = 3102;
const MALICIOUS_FILE_NAME = '../../etc/passwd';

interface UploadInterface {
  id: string;
  url: string;
  headers: Record<string, string>;
}

function putFromBareProcess(url: string, headers: Record<string, string>, body: Buffer): Promise<number> {
  const script = `
    const body = Buffer.from(process.argv[1], 'base64');
    fetch(process.argv[2], { method: 'PUT', body, headers: JSON.parse(process.argv[3]) })
      .then((response) => console.log(response.status))
      .catch(() => console.log(0));`;
  const child = spawn(process.execPath, ['-e', script, body.toString('base64'), url, JSON.stringify(headers)], {
    env: { PATH: process.env.PATH },
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  return new Promise((resolve) => child.on('exit', () => resolve(Number(output.trim()) || 0)));
}

async function requestUpload(api: string, token: string, body: Buffer): Promise<[number, UploadInterface]> {
  const response = await fetch(`${api}/media/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ mimeType: 'image/png', sizeBytes: body.length, fileName: MALICIOUS_FILE_NAME }),
  });
  return [response.status, await json<UploadInterface>(response)];
}

async function complete(api: string, token: string, id: string): Promise<number> {
  return (await fetch(`${api}/media/${id}/complete`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })).status;
}

async function main(): Promise<void> {
  const { client, bucket } = storage();
  const image = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(4096)]);

  let api = await startApi(FIRST_PORT);
  let base = `http://127.0.0.1:${FIRST_PORT}`;
  const token = await demoToken(base, 'demo-upload@example.com');
  const owner = identityOf(token);
  note(`cleanup: removed ${await deletePrefix(client, bucket, `media/${owner}/`)} objects of the demo user`);

  const [intentStatus, upload] = await requestUpload(base, token, image);
  report('intent', intentStatus);
  const key = decodeURIComponent(new URL(upload.url).pathname).replace(`/${bucket}/`, '');
  note(`client sent fileName=${MALICIOUS_FILE_NAME}, server chose key=${key}`);
  report('key-from-server', key.startsWith(`media/${owner}/`) && !key.includes('..') && !key.includes('passwd') ? 1 : 0);

  await stopProcess(api, FIRST_PORT);
  report('api-alive', (await isPortOpen(FIRST_PORT)) ? 1 : 0);
  report('put-offline', await putFromBareProcess(upload.url, upload.headers, image));

  api = await startApi(SECOND_PORT);
  base = `http://127.0.0.1:${SECOND_PORT}`;
  report('commit', await complete(base, token, upload.id));

  const [, empty] = await requestUpload(base, token, image);
  report('commit-without-bytes', await complete(base, token, empty.id));

  const [, victim] = await requestUpload(base, token, image);
  const tampered = new URL(victim.url);
  tampered.pathname = tampered.pathname.replace(/[0-9a-f]{8}-/, '00000000-');
  report('tampered', (await fetch(tampered, { method: 'PUT', body: image, headers: victim.headers })).status);

  const shortLived = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 1 });
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  report('expired', (await fetch(shortLived, { method: 'PUT', body: image })).status);

  await stopProcess(api, SECOND_PORT);
  client.destroy();
  verify({
    intent: 200,
    'key-from-server': 1,
    'api-alive': 0,
    'put-offline': 200,
    commit: 200,
    'commit-without-bytes': (status) => status >= 400 && status < 500,
    tampered: 403,
    expired: 403,
  });
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
