import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entity/order.entity.js';
import { OrderProduct } from '../entity/order-product.entity.js';
import { OrderRecipient } from '../entity/order-recipient.entity.js';
import { CurrencyEnum, StatusEnum } from '../../entities/enums.js';

/**
 * Вход репозитория не совпадает с клиентским CreateOrderDto: он ничего не знает
 * про CreatePhoneDto/CreateDeliveryAddressDto, только про уже готовые
 * phoneId/deliveryAddressId — их разрешает OrderService до вызова create().
 */
export interface CreateOrderRecipientInput {
  buyerId: number;
  fullName: string;
  phoneId: number;
  deliveryAddressId: number;
}

export interface CreateOrderItemInput {
  productOfferId: number;
  quantity: number;
  price: string;
  discountPrice?: string | null;
}

export interface CreateOrderInput {
  recipient: CreateOrderRecipientInput;
  items: CreateOrderItemInput[];
  totalAmount: string;
  discountAmount?: string;
  currency: CurrencyEnum;
  status?: StatusEnum;
}

/**
 * Только create(): создаёт три строки — OrderRecipient, Order, OrderProduct[] —
 * ровно из того, что пришло. Никакой дополнительной логики (пересчёта сумм,
 * транзакции) — это на будущее ДЗ.
 */
@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderProduct) private readonly orderProducts: Repository<OrderProduct>,
    @InjectRepository(OrderRecipient) private readonly orderRecipients: Repository<OrderRecipient>,
  ) {}

  async create(input: CreateOrderInput): Promise<Order> {
    const recipient = await this.orderRecipients.save(this.orderRecipients.create(input.recipient));

    const order = await this.orders.save(
      this.orders.create({
        orderRecipientId: recipient.id,
        status: input.status,
        totalAmount: input.totalAmount,
        discountAmount: input.discountAmount,
        currency: input.currency,
      }),
    );

    await this.orderProducts.save(
      input.items.map((item) =>
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
