import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Order } from '../entity/order.entity.js';
import { CurrencyEnum } from '../../entities/enums.js';

export interface CreateOrderInput {
  orderRecipientId: number;
  totalAmount: string;
  discountAmount: string;
  currency: CurrencyEnum;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: CreateOrderInput): Promise<Order> {
    const orders = this.txHost.tx.getRepository(Order);
    return orders.save(orders.create(input));
  }
}
