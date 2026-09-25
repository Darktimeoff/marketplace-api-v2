import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClsModule } from "nestjs-cls";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { DataSource } from "typeorm";
import { TransactionalAdapterTypeOrmWithRetry } from "./typeorm-retry.adapter.js";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        type: "postgres",
        autoLoadEntities: true,
        synchronize: false,
        host: environment.get("DBHOST"),
        port: environment.get("DBPORT"),
        username: environment.get("DBUSER"),
        database: environment.get("DBNAME"),
        password: async () => await secrets.get("DBPASSWORD"),
      }),
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
