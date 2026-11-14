import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable } from '@nestjs/common';
import type { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { getTlsOptions } from '../tls/util/get-tls-options.util.js';

@Injectable()
export class PostgresOptionsService implements TypeOrmOptionsFactory {
  private readonly distDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  constructor(
    private readonly environment: EnvironmentService,
    private readonly secrets: SecretManagerService,
  ) {}

  async createTypeOrmOptions(): Promise<TypeOrmModuleOptions> {
    return {
      ...(await this.connectionOptions()),
      autoLoadEntities: true,
      synchronize: false,
    };
  }

  async createMigrationOptions(): Promise<DataSourceOptions> {
    return {
      ...(await this.connectionOptions()),
      entities: [join(this.distDir, '**', 'entity', '*.entity.js')],
      migrations: [join(this.distDir, 'migrations', '*.js')],
      migrationsTableName: 'migrations',
    };
  }

  private async connectionOptions() {
    return {
      type: 'postgres' as const,
      host: this.environment.get('DBHOST'),
      port: this.environment.get('DBPORT'),
      username: await this.secrets.get('DBUSER'),
      database: this.environment.get('DBNAME'),
      password: async () => await this.secrets.get('DBPASSWORD'),
      ssl: getTlsOptions(this.environment.get('TLS_MODE'), this.environment.get('TLS_CA_PATH'), this.environment.get('DBHOST')),
    };
  }
}
