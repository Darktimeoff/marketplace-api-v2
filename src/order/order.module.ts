import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./entity/order.entity.js";
import { OrderProduct } from "./entity/order-product.entity.js";
import { OrderRecipient } from "./entity/order-recipient.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderProduct, OrderRecipient])],
  exports: [TypeOrmModule]
})
export class OrderModule {
  
}