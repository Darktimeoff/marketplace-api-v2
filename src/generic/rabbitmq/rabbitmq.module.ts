import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { RABBITMQ_EXCHANGE_NAME } from "./constant/rabbitmq_exchange_name.constant.js";
import { getRabbitMqConnectionUri } from "./util/get-rabbitmq-connection-uri.util.js";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        exchanges: [
          {
            name: RABBITMQ_EXCHANGE_NAME,
            type: 'topic',
            options: { durable: true },
          },
        ],
        uri: await getRabbitMqConnectionUri(environment, secrets),
        connectionInitOptions: { wait: true, timeout: 5000 },
        enableControllerDiscovery: true,
        defaultPublishOptions: {
          persistent: true,
          mandatory: true
        }
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitMqModule {}
