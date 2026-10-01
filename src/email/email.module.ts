import { Module } from "@nestjs/common";
import { RabbitMqModule } from "../generic/rabbitmq/rabbitmq.module.js";
import { OrderEmailGateway } from "./controller/order-email.gateway.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Inbox } from "./entity/inbox.entity.js";
import { InboxRepository } from "./repository/inbox.repository.js";
import { InboxService } from "./service/inbox.service.js";
import { EmailService } from "./service/email.service.js";
;

@Module({
  imports: [
    RabbitMqModule,
    TypeOrmModule.forFeature([Inbox]),
  ],
  providers: [OrderEmailGateway, InboxRepository, InboxService, EmailService]
})
export class EmailModule {}