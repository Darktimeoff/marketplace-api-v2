import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./entity/order.entity.js";
import { OrderProduct } from "./entity/order-product.entity.js";
import { OrderRecipient } from "./entity/order-recipient.entity.js";
import { OrderRepository } from "./repository/order.repository.js";
import { OrderService } from "./service/order.service.js";
import { OrderController } from "./controller/order.controller.js";

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderProduct, OrderRecipient])],
  controllers: [OrderController],
  providers: [OrderRepository, OrderService],
  exports: [TypeOrmModule]
})
export class OrderModule {

}