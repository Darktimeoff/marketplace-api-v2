import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  OrderRecipient,
  type OrderRecipientCreateEntityInterface,
} from '../entity/order-recipient.entity.js';

@Injectable()
export class OrderRecipientRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: OrderRecipientCreateEntityInterface): Promise<OrderRecipient> {
    const orderRecipients = this.txHost.tx.getRepository(OrderRecipient);
    return orderRecipients.save(orderRecipients.create(input));
  }
}
