import { RabbitMQConfig } from "@golevelup/nestjs-rabbitmq";
import { EnvironmentModule, EnvironmentService } from "../../generic/environment/environment.module.js";
import { SecretManagerService } from "../../generic/secret-manager/secret-manager.service.js";
import { SecretManagerModule } from "../../generic/secret-manager/secret-manager.module.js";
import { RABBITMQ_EXCHANGE_NAME } from "../../generic/rabbitmq/constant/rabbitmq_exchange_name.constant.js";
import { getRabbitMqConnectionUri } from "../../generic/rabbitmq/util/get-rabbitmq-connection-uri.util.js";

type RabbitMqAsyncOptions = {
  imports: any[];
  inject: any[];
  useFactory: (environment: EnvironmentService, secrets: SecretManagerService) => Promise<RabbitMQConfig>
};


export function createRabbitMqConfig(): RabbitMqAsyncOptions {
  return {
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
    })
  }
}