import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderRecipient } from '../entity/order-recipient.entity.js';

export interface CreateOrderRecipientInput {
  buyerId: number;
  fullName: string;
  phoneId: number;
  deliveryAddressId: number;
}

@Injectable()
export class OrderRecipientRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: CreateOrderRecipientInput): Promise<OrderRecipient> {
    const orderRecipients = this.txHost.tx.getRepository(OrderRecipient);
    return orderRecipients.save(orderRecipients.create(input));
  }
}
