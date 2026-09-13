import { Module } from "@nestjs/common";
import { OrderRepository } from "./repository/order.repository.js";
import { OrderRecipientRepository } from "./repository/order-recipient.repository.js";
import { OrderProductRepository } from "./repository/order-product.repository.js";
import { OrderService } from "./service/order.service.js";
import { OrderController } from "./controller/order.controller.js";
import { PhoneModule } from "../phone/phone.module.js";
import { DeliveryAddressModule } from "../delivery-address/delivery-address.module.js";
import { ProductOfferModule } from "../product-offer/product-offer.module.js";

@Module({
  imports: [PhoneModule, DeliveryAddressModule, ProductOfferModule],
  controllers: [OrderController],
  providers: [OrderRepository, OrderRecipientRepository, OrderProductRepository, OrderService],
})
export class OrderModule {}
