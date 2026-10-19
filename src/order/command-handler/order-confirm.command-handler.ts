// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OrderInboxRepository } from '../repository/order-inbox.repository.js';
import { OrderConfirmationRepository } from '../repository/order-confirmation.repository.js';
import { OrderInboxConsumerEnum } from '../enum/order-inbox-consumer.enum.js';
import type { OrderConfirmationCreateEntityInterface } from '../entity/order-confirmation.entity.js';

@Injectable()
export class OrderConfirmCommandHandler {
  constructor(
    private readonly inbox: OrderInboxRepository,
    private readonly confirmations: OrderConfirmationRepository,
  ) {}

  @Transactional()
  async execute(messageId: string, confirmation: OrderConfirmationCreateEntityInterface): Promise<boolean> {
    if (!(await this.inbox.createIfAbsent({ consumer: OrderInboxConsumerEnum.CONFIRMATION, messageId }))) {
      return false;
    }

    await this.confirmations.create(confirmation);
    return true;
  }
}
