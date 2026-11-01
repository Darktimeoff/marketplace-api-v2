import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { getRabbitMqConnectionUri } from "./util/get-rabbitmq-connection-uri.util.js";
import { RabbitMqReturnListenerService } from "./rabbitmq-return-listener.service.js";
import { RabbitMqRpcService } from "./rabbitmq-rpc.service.js";
import { RabbitMqChannelEnum } from "./enum/rabbitmq-channel.enum.js";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        uri: await getRabbitMqConnectionUri(environment, secrets),
        connectionInitOptions: { wait: true, timeout: 5000 },
        enableControllerDiscovery: true,
        channels: {
          [RabbitMqChannelEnum.WORK]: { prefetchCount: 1 },
        },
        defaultPublishOptions: {
          persistent: true,
          mandatory: true
        }
      }),
    }),
  ],
  providers: [RabbitMqReturnListenerService, RabbitMqRpcService],
  exports: [RabbitMQModule, RabbitMqRpcService],
})
export class RabbitMqModule {}
