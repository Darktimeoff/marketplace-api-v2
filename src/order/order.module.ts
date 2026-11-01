import { QueueModule } from "../generic/queue/queue.module.js";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./entity/order.entity.js";
import { OrderLine } from "./entity/order-line.entity.js";
import { OrderRecipient } from "./entity/order-recipient.entity.js";
import { OrderOutbox } from "./entity/order-outbox.entity.js";
import { OrderOutboxRepository } from "./repository/order-outbox.repository.js";
import { OrderOutboxRelay } from "./relay/order-outbox.relay.js";
import { OrderOutboxCleanupCron } from "./cron/order-outbox-cleanup.cron.js";
import { OrderWorkflowOutbox } from "./entity/order-workflow-outbox.entity.js";
import { OrderBuyer } from "./entity/order-buyer.entity.js";
import { OrderBuyerRepository } from "./repository/order-buyer.repository.js";
import { OrderBuyerRegisterCommandHandler } from "./command-handler/order-buyer-register.command-handler.js";
import { OrderUserEventsConsumer } from "./consumer/order-user-events.consumer.js";
import { OrderWorkflowOutboxRepository } from "./repository/order-workflow-outbox.repository.js";
import { OrderWorkflowOutboxRelay } from "./relay/order-workflow-outbox.relay.js";
import { OrderWorkflowOutboxCleanupCron } from "./cron/order-workflow-outbox-cleanup.cron.js";
import { OrderNotifyEventsConsumer } from "./consumer/order-notify-events.consumer.js";
import { OrderPlaceMessage } from "./message/order-place.message.js";
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
import { SellerOfferClient } from "./client/seller-offer.client.js";
import { ACCOUNT_CLIENT, SELLER_OFFER_CLIENT } from "./constant/order-client.constant.js";
import { AccountClient } from "./client/account.client.js";
import { OrderResponse } from "./response/order.response.js";
import { AccountModule } from "../account/account.module.js";
import { OrderAccessGuard } from "./guard/order-access.guard.js";
import { KafkaModule } from "../generic/kafka/kafka.module.js";
import { TemporalModule } from "../generic/temporal/temporal.module.js";
import { CacheModule } from "../generic/cache/cache.module.js";
import { OrderPlaceActivity } from "./activity/order-place.activity.js";
import { OrderPlaceWorker } from "./worker/order-place.worker.js";
import { RabbitMqModule } from "../generic/rabbitmq/rabbitmq.module.js";
import { MessagingModule } from "../generic/messaging/messaging.module.js";

@Module({
  imports: [
    QueueModule,
    KafkaModule,
    MessagingModule,
    TemporalModule,
    CacheModule,
    TypeOrmModule.forFeature([Order, OrderLine, OrderRecipient, OrderOutbox, OrderWorkflowOutbox, OrderBuyer]),
    SellerOfferModule,
    RabbitMqModule,
    AccountModule,
  ],
  controllers: [OrderController, OrdersController],
  providers: [
    { provide: SELLER_OFFER_CLIENT, useClass: SellerOfferClient },
    { provide: ACCOUNT_CLIENT, useClass: AccountClient },
    OrderResponse,
    OrderRepository,
    OrderRecipientRepository,
    OrderLineRepository,
    OrderOutboxRepository,
    OrderOutboxRelay,
    OrderOutboxCleanupCron,
    OrderWorkflowOutboxRepository,
    OrderWorkflowOutboxRelay,
    OrderWorkflowOutboxCleanupCron,
    OrderBuyerRepository,
    OrderBuyerRegisterCommandHandler,
    OrderUserEventsConsumer,
    OrderNotifyEventsConsumer,
    OrderPlaceMessage,
    OrderService,
    OrderPlaceCommandHandler,
    OrderAccessService,
    OrderNotifyService,
    OrderAccessGuard,
    OrderPlaceActivity,
    OrderPlaceWorker,
  ]
})
export class OrderModule {}
