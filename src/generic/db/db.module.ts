import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { entities } from "../../entities/all.js";

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
  ],
  exports: [TypeOrmModule],
})
export class DBModule {}
