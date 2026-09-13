import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderRecipient } from '../entity/order-recipient.entity.js';

export interface CreateOrderRecipientInput {
  buyerId: number;
  fullName: string;
  phoneId: number;
  deliveryAddressId: number;
}

@Injectable()
export class OrderRecipientRepository {
  constructor(
    @InjectRepository(OrderRecipient) private readonly orderRecipients: Repository<OrderRecipient>,
  ) {}

  create(input: CreateOrderRecipientInput): Promise<OrderRecipient> {
    return this.orderRecipients.save(this.orderRecipients.create(input));
  }
}
