import { Injectable } from '@nestjs/common';
import { OrderBuyerRepository } from '../repository/order-buyer.repository.js';
import type { OrderBuyerCreateEntityInterface } from '../entity/order-buyer.entity.js';

@Injectable()
export class OrderBuyerRegisterCommandHandler {
  constructor(private readonly buyers: OrderBuyerRepository) {}

  execute(input: OrderBuyerCreateEntityInterface): Promise<boolean> {
    return this.buyers.createIfAbsent(input);
  }
}
