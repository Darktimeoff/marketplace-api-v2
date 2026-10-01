import { Module } from "@nestjs/common";
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { createRabbitMqConfig } from "./config/create-rabbitmq.config.js";
import { OrderEmailGateway } from "./controller/order-email.gateway.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailInbox } from "./entity/email-inbox.entity.js";
import { EmailInboxRepository } from "./repository/email-inbox.repository.js";
import { EmailService } from "./service/email.service.js";
;

@Module({
  imports: [
    RabbitMQModule.forRootAsync(createRabbitMqConfig()),
    TypeOrmModule.forFeature([EmailInbox]),
  ],
  providers: [OrderEmailGateway, EmailInboxRepository, EmailService]
})
export class EmailModule {}