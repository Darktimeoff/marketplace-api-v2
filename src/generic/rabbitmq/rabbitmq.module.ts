import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { RABBITMQ_EXCHANGE_NAME } from "./constant/rabbitmq_exchange_name.constant.js";
import { RABBITMQ_EMAIL_CHANNEL_NAME } from "./constant/rabbitmq_email_channel_name.constant.js";
import { getRabbitMqConnectionUri } from "./util/get-rabbitmq-connection-uri.util.js";
import { RABBITMQ_EXCHANGE_EMAIL_DLX } from "./constant/rabbitmq_exchange_email_dlx.constant.js";
import { RABBITMQ_ROUTING_KEY_EMAIL_DLX } from "./constant/rabbitmq_routing_key_email_dlx.constant.js";

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
          { name: RABBITMQ_EXCHANGE_EMAIL_DLX, type: 'topic', options: { durable: true } }
        ],
        queues: [
          {
            name: 'email.dlq',
            options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
            exchange: RABBITMQ_EXCHANGE_EMAIL_DLX,
            routingKey: RABBITMQ_ROUTING_KEY_EMAIL_DLX,
          },
        ],
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
