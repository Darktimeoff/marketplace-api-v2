import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { NestFactoryStatic } from '@nestjs/core/nest-factory.js';
import { RouterExecutionContext } from '@nestjs/core/router/router-execution-context.js';

describe('Nest instrumentation on Nest 12', () => {
  it('finds the two Nest internals it patches, so the controller spans are still produced', () => {
    expect(typeof NestFactoryStatic.prototype.create).toBe('function');
    expect(typeof RouterExecutionContext.prototype.create).toBe('function');
  });

  it('still needs the widened range, because the package does not support Nest 12 itself', () => {
    const require = createRequire(import.meta.url);
    const packageDir = require.resolve('@opentelemetry/instrumentation-nestjs-core').replace(/dist\/.*$/, '');
    const source = readFileSync(`${packageDir}dist/instrumentation.mjs`, 'utf8');

    expect(source).toContain('const supportedVersions = [">=4.0.0 <12"]');
  });
});
