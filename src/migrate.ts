import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { MigrateModule } from './migrate.module.js';
import { PostgresOptionsService } from './generic/db/postgres-options.service.js';

async function migrate() {
  const logger = new Logger('Migrate');
  const context = await NestFactory.createApplicationContext(MigrateModule, { logger: ['log', 'warn', 'error'] });
  const dataSource = new DataSource(await context.get(PostgresOptionsService).createMigrationOptions());

  try {
    await dataSource.initialize();
    const applied = await dataSource.runMigrations();
    logger.log(applied.length > 0 ? `applied ${applied.length} migration(s): ${applied.map(({ name }) => name).join(', ')}` : 'no pending migrations');
  } finally {
    await dataSource.destroy().catch(() => undefined);
    await context.close();
  }
}

await migrate();
