import { Module } from "@nestjs/common";
import { RabbitMqModule } from "../generic/rabbitmq/rabbitmq.module.js";
import { OrderEmailGateway } from "./controller/order-email.gateway.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailInbox } from "./entity/email-inbox.entity.js";
import { EmailInboxRepository } from "./repository/email-inbox.repository.js";
import { EmailService } from "./service/email.service.js";
;

@Module({
  imports: [
    RabbitMqModule,
    TypeOrmModule.forFeature([EmailInbox]),
  ],
  providers: [OrderEmailGateway, EmailInboxRepository, EmailService]
})
export class EmailModule {}