import { Test } from '@nestjs/testing';
import type { INestApplicationContext, ModuleMetadata } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DBModule } from '../../src/generic/db/db.module.js';
import { testEntities } from './migrations.js';

export interface TestModule {
  app: INestApplicationContext;
  dataSource: DataSource;
  close(): Promise<void>;
}

export async function createTestModule(
  imports: NonNullable<ModuleMetadata['imports']>,
): Promise<TestModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [DBModule, TypeOrmModule.forFeature(testEntities), ...imports],
  }).compile();

  const app = await moduleRef.init();
  const dataSource = app.get(DataSource);

  return {
    app,
    dataSource,
    close: () => app.close(),
  };
}
