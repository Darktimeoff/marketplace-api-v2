// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderConfirmation, type OrderConfirmationCreateEntityInterface } from '../entity/order-confirmation.entity.js';

@Injectable()
export class OrderConfirmationRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async create(input: OrderConfirmationCreateEntityInterface): Promise<void> {
    await this.txHost.tx.getRepository(OrderConfirmation).insert(input);
  }
}
