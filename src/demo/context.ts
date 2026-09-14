import 'reflect-metadata';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';

export async function runDemo(
  main: (app: INestApplicationContext) => Promise<boolean>,
): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  try {
    const ok = await main(app);
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

export function checkInvariant(label: string, ok: boolean, detail: string): boolean {
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${detail}`);
  return ok;
}
