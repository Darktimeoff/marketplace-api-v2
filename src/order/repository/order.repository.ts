import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entity/order.entity.js';
import { OrderProduct } from '../entity/order-product.entity.js';
import { OrderRecipient } from '../entity/order-recipient.entity.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';

/**
 * Только create(): создаёт три строки — OrderRecipient, Order, OrderProduct[] —
 * ровно из того, что пришло в DTO. Никакой дополнительной логики (снапшотов,
 * пересчёта сумм, транзакции) — это на будущее ДЗ.
 */
@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderProduct) private readonly orderProducts: Repository<OrderProduct>,
    @InjectRepository(OrderRecipient) private readonly orderRecipients: Repository<OrderRecipient>,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const recipient = await this.orderRecipients.save(this.orderRecipients.create(dto.recipient));

    const order = await this.orders.save(
      this.orders.create({
        orderRecipientId: recipient.id,
        status: dto.status,
        totalAmount: dto.totalAmount,
        discountAmount: dto.discountAmount,
        currency: dto.currency,
      }),
    );

    await this.orderProducts.save(
      dto.items.map((item) =>
        this.orderProducts.create({
          orderId: order.id,
          productOfferId: item.productOfferId,
          quantity: item.quantity,
          price: item.price,
          discountPrice: item.discountPrice,
        }),
      ),
    );

    return order;
  }
}
