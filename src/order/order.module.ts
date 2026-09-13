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
import { PhoneModule } from "../phone/phone.module.js";
import { DeliveryAddressModule } from "../delivery-address/delivery-address.module.js";
import { ProductOfferModule } from "../product-offer/product-offer.module.js";
import { BackgroundJobModule } from "../background-job/background-job.module.js";
import { AccountModule } from "../account/account.module.js";
import { OrderSaga } from "./saga/order.saga.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderProduct, OrderRecipient]),
    PhoneModule,
    DeliveryAddressModule,
    ProductOfferModule,
    BackgroundJobModule,
    AccountModule,
  ],
  controllers: [OrderController],
  providers: [OrderRepository, OrderRecipientRepository, OrderProductRepository, OrderService, OrderSaga],
})
export class OrderModule {}
