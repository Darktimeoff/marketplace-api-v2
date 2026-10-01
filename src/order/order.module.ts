import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./entity/order.entity.js";
import { OrderProduct } from "./entity/order-product.entity.js";
import { OrderRecipient } from "./entity/order-recipient.entity.js";
import { OrderRepository } from "./repository/order.repository.js";
import { OrderRecipientRepository } from "./repository/order-recipient.repository.js";
import { OrderProductRepository } from "./repository/order-product.repository.js";
import { OrderService } from "./service/order.service.js";
import { OrderController } from "./controller/order.controller.js";
import { OrdersController } from './controller/orders.controller.js';
import { OrderGateway } from './controller/order.gateway.js';
import { OrderNotifyService } from './service/order-notify.service.js';
import { OrderAccessService } from './service/order-access.service.js';
import { PhoneModule } from "../phone/phone.module.js";
import { DeliveryAddressModule } from "../delivery-address/delivery-address.module.js";
import { SellerOfferModule } from "../seller-offer/seller-offer.module.js";
import { BackgroundJobModule } from "../background-job/background-job.module.js";
import { AccountModule } from "../account/account.module.js";
import { OrderAccessGuard } from "./guard/order-access.guard.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderProduct, OrderRecipient]),
    PhoneModule,
    DeliveryAddressModule,
    SellerOfferModule,
    BackgroundJobModule,
    AccountModule,
  ],
  controllers: [OrderController, OrdersController],
  providers: [
    OrderRepository,
    OrderRecipientRepository,
    OrderProductRepository,
    OrderService,
    OrderAccessService,
    OrderNotifyService,
    OrderGateway,
    OrderAccessGuard,
  ]
})
export class OrderModule {}
