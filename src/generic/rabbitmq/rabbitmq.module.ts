import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { TopicEnum } from "@marketplace/messaging-contracts";
import { RABBITMQ_EMAIL_CHANNEL_NAME } from "./constant/rabbitmq_email_channel_name.constant.js";
import { getRabbitMqConnectionUri } from "./util/get-rabbitmq-connection-uri.util.js";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        exchanges: Object.values(TopicEnum).map((name) => ({
          name,
          type: 'topic',
          options: { durable: true },
        })),
        uri: await getRabbitMqConnectionUri(environment, secrets),
        connectionInitOptions: { wait: true, timeout: 5000 },
        enableControllerDiscovery: true,
        channels: {
          [RABBITMQ_EMAIL_CHANNEL_NAME]: {
            prefetchCount: 10,
          },
        },
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
