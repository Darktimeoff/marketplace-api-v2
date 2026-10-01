import { RabbitMQConfig } from "@golevelup/nestjs-rabbitmq";
import { EnvironmentModule, EnvironmentService } from "../../generic/environment/environment.module.js";
import { SecretManagerService } from "../../generic/secret-manager/secret-manager.service.js";
import { SecretManagerModule } from "../../generic/secret-manager/secret-manager.module.js";
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
      uri: await getRabbitMqConnectionUri(environment, secrets),
      connectionInitOptions: { wait: true, timeout: 5000 },
      enableControllerDiscovery: true
    })
  }
}