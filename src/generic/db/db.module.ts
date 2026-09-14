import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClsModule } from "nestjs-cls";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { DataSource } from "typeorm";
import { TransactionalAdapterTypeOrmWithRetry } from "./typeorm-retry.adapter.js";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { entities as sharedEntities } from "../../entities/all.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        type: "postgres",
        // Entity с owner-модулем (Order, BackgroundJob, Phone, DeliveryAddress,
        // ProductOffer, ...) сюда не добавляются — они регистрируются через
        // TypeOrmModule.forFeature([...]) в своих модулях и подхватываются
        // autoLoadEntities. sharedEntities — только entity без owner-модуля.
        entities: sharedEntities,
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
          }),
        }),
      ],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DBModule {}
