import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClsModule } from "nestjs-cls";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterTypeOrm } from "@nestjs-cls/transactional-adapter-typeorm";
import { DataSource } from "typeorm";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { entities as sharedEntities } from "../../entities/all.js";
import { Order } from "../../order/entity/order.entity.js";
import { OrderProduct } from "../../order/entity/order-product.entity.js";
import { OrderRecipient } from "../../order/entity/order-recipient.entity.js";

const entities = [...sharedEntities, Order, OrderProduct, OrderRecipient];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        type: "postgres",
        entities,
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
          adapter: new TransactionalAdapterTypeOrm({
            dataSourceToken: DataSource,
          }),
        }),
      ],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DBModule {}
