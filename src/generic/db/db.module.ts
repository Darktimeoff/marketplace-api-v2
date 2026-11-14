import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClsModule } from "nestjs-cls";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { DataSource } from "typeorm";
import { TransactionalAdapterTypeOrmWithRetry } from "./typeorm-retry.adapter.js";
import { PostgresOptionsService } from "./postgres-options.service.js";
import { EnvironmentModule } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      useClass: PostgresOptionsService,
    }),
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterTypeOrmWithRetry({
            dataSourceToken: DataSource,
            maxAttempts: 10,
            baseDelayMs: 20,
          }),
        }),
      ],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DBModule {}
