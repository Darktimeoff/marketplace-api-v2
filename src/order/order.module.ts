import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./entity/order.entity.js";
import { OrderLine } from "./entity/order-line.entity.js";
import { OrderRecipient } from "./entity/order-recipient.entity.js";
import { OrderOutbox } from "./entity/order-outbox.entity.js";
import { OrderOutboxRepository } from "./repository/order-outbox.repository.js";
import { OrderOutboxRelayService } from "./service/order-outbox-relay.service.js";
import { OrderRepository } from "./repository/order.repository.js";
import { OrderRecipientRepository } from "./repository/order-recipient.repository.js";
import { OrderLineRepository } from "./repository/order-line.repository.js";
import { OrderService } from "./service/order.service.js";
import { OrderPlaceCommandHandler } from "./command-handler/order-place.command-handler.js";
import { OrderController } from "./controller/order.controller.js";
import { OrdersController } from './controller/orders.controller.js';
import { OrderNotifyService } from './service/order-notify.service.js';
import { OrderAccessService } from './service/order-access.service.js';
import { SellerOfferModule } from "../seller-offer/seller-offer.module.js";
import { AccountModule } from "../account/account.module.js";
import { OrderAccessGuard } from "./guard/order-access.guard.js";
import { RabbitMqModule } from "../generic/rabbitmq/rabbitmq.module.js";
import { KafkaModule } from "../generic/kafka/kafka.module.js";

@Module({
  imports: [
    RabbitMqModule,
    KafkaModule,
    TypeOrmModule.forFeature([Order, OrderLine, OrderRecipient, OrderOutbox]),
    SellerOfferModule,
    AccountModule,
  ],
  controllers: [OrderController, OrdersController],
  providers: [
    OrderRepository,
    OrderRecipientRepository,
    OrderLineRepository,
    OrderOutboxRepository,
    OrderOutboxRelayService,
    OrderService,
    OrderPlaceCommandHandler,
    OrderAccessService,
    OrderNotifyService,
    OrderAccessGuard,
  ]
})
export class OrderModule {}
