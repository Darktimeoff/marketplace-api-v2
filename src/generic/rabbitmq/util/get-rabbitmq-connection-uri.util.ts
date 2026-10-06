import { EnvironmentService } from "../../environment/environment.module.js";
import { SecretManagerService } from "../../secret-manager/secret-manager.service.js";

export async function getRabbitMqConnectionUri(environment: EnvironmentService, secrets: SecretManagerService) {
  const user = await secrets.get('RABBITMQ_USER')
  const password = await secrets.get('RABBITMQ_PASSWORD');
  const host = environment.get('RABBITMQ_HOST')
  const port = environment.get('RABBITMQ_PORT')

  return `amqp://${user}:${password}@${host}:${port}`;
}