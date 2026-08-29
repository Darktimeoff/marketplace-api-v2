import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const schemaPath = path.join(rootDir, 'src/generic/environment/environment.schema.ts');
const envExamplePath = path.join(rootDir, '.env.example');

function extractSchemaKeys(source) {
  const objectStart = source.indexOf('z.object({');
  if (objectStart === -1) {
    throw new Error(`Could not find "z.object({" in ${schemaPath}`);
  }

  let depth = 0;
  let bodyStart = -1;
  let bodyEnd = -1;
  for (let i = objectStart; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error(`Could not parse the z.object({ ... }) body in ${schemaPath}`);
  }

  const body = source.slice(bodyStart, bodyEnd);
  const keys = [...body.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm)].map((m) => m[1]);

  if (keys.length === 0) {
    throw new Error(`Found no keys inside z.object({ ... }) in ${schemaPath}`);
  }

  return new Set(keys);
}

function extractEnvExampleKeys(source) {
  return new Set(
    source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
      .filter(Boolean),
  );
}

const schemaKeys = extractSchemaKeys(readFileSync(schemaPath, 'utf8'));
const envExampleKeys = extractEnvExampleKeys(readFileSync(envExamplePath, 'utf8'));

const missingFromEnvExample = [...schemaKeys].filter((key) => !envExampleKeys.has(key));
const staleInEnvExample = [...envExampleKeys].filter((key) => !schemaKeys.has(key));

if (missingFromEnvExample.length > 0 || staleInEnvExample.length > 0) {
  console.error('.env.example is out of sync with environment.schema.ts');
  if (missingFromEnvExample.length > 0) {
    console.error(`  missing from .env.example: ${missingFromEnvExample.join(', ')}`);
  }
  if (staleInEnvExample.length > 0) {
    console.error(`  no longer in the schema: ${staleInEnvExample.join(', ')}`);
  }
  process.exit(1);
}

console.log(`.env.example is in sync with the schema (${schemaKeys.size} variable(s)).`);
