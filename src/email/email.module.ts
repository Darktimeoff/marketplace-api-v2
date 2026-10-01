import { Module } from "@nestjs/common";
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { createRabbitMqConfig } from "./config/create-rabbitmq.config.js";
import { EmailGateway } from "./controller/email.gateway.js";
;

@Module({
  imports: [
    RabbitMQModule.forRootAsync(createRabbitMqConfig),
  ],
  providers: [EmailGateway]
})
export class EmailModule {}