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
import { OrderUserEventsGateway } from "./gateway/order-user-events.gateway.js";
import { OrderWorkflowOutboxRepository } from "./repository/order-workflow-outbox.repository.js";
import { OrderWorkflowOutboxRelay } from "./relay/order-workflow-outbox.relay.js";
import { OrderWorkflowOutboxCleanupCron } from "./cron/order-workflow-outbox-cleanup.cron.js";
import { OrderNotifyEventsGateway } from "./gateway/order-notify-events.gateway.js";
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
import { AccountModule } from "../account/account.module.js";
import { OrderAccessGuard } from "./guard/order-access.guard.js";
import { RabbitMqModule } from "../generic/rabbitmq/rabbitmq.module.js";
import { KafkaModule } from "../generic/kafka/kafka.module.js";
import { TemporalModule } from "../generic/temporal/temporal.module.js";
import { CacheModule } from "../generic/cache/cache.module.js";
import { OrderPlaceActivity } from "./activity/order-place.activity.js";
import { OrderPlaceWorker } from "./worker/order-place.worker.js";

@Module({
  imports: [
    QueueModule,
    RabbitMqModule,
    KafkaModule,
    TemporalModule,
    CacheModule,
    TypeOrmModule.forFeature([Order, OrderLine, OrderRecipient, OrderOutbox, OrderWorkflowOutbox, OrderBuyer]),
    SellerOfferModule,
    AccountModule,
  ],
  controllers: [OrderController, OrdersController],
  providers: [
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
    OrderUserEventsGateway,
    OrderNotifyEventsGateway,
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
