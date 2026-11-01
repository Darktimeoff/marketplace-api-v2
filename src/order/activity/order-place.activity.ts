import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ApplicationFailure } from '@temporalio/activity';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderRepository } from '../repository/order.repository.js';
import { OrderOutboxRepository } from '../repository/order-outbox.repository.js';
import { OrderPlaceMessage } from '../message/order-place.message.js';
import { ACCOUNT_CLIENT, SELLER_OFFER_CLIENT } from '../constant/order-client.constant.js';
import type { SellerOfferClientInterface } from '../client/seller-offer.client.interface.js';
import type { AccountClientInterface } from '../client/account.client.interface.js';
import { CacheEvict } from '../../generic/cache/decorator/cache-evict.decorator.js';
import { orderCacheKey } from '../cache-key/order.cache-key.js';
import { OrderPlaceFailureTypeEnum } from '../enum/order-place-failure-type.enum.js';
import type { OrderFailureInterface } from '../interface/order-failure.interface.js';
import type {
  OrderPlaceActivitiesInterface,
  OrderPlaceChargeInterface,
  OrderPlaceItemInterface,
} from '../workflow/order-place-workflow.interface.js';

@Injectable()
export class OrderPlaceActivity implements OrderPlaceActivitiesInterface {
  constructor(
    @Inject(SELLER_OFFER_CLIENT) private readonly sellerOffers: SellerOfferClientInterface,
    @Inject(ACCOUNT_CLIENT) private readonly accounts: AccountClientInterface,
    private readonly orderRepository: OrderRepository,
    private readonly outbox: OrderOutboxRepository,
    private readonly messages: OrderPlaceMessage,
  ) {}

  async reserveStock(orderPublicId: string, items: OrderPlaceItemInterface[]): Promise<void> {
    const data = await this.sellerOffers.reserveStock({ orderPublicId, items });

    if (data.status === 'rejected') {
      throw ApplicationFailure.nonRetryable(`insufficient stock for order=${orderPublicId}`, OrderPlaceFailureTypeEnum.INSUFFICIENT_STOCK, data.items);
    }
  }

  async releaseStock(orderPublicId: string): Promise<void> {
    await this.sellerOffers.releaseStock({ orderPublicId });
  }

  async chargeCustomer({ orderPublicId, buyerPublicId, totalAmount }: OrderPlaceChargeInterface): Promise<void> {
    const data = await this.accounts.charge({ chargeId: orderPublicId, customerPublicId: buyerPublicId, amount: totalAmount });

    if (data.status === 'rejected') {
      throw ApplicationFailure.nonRetryable(`payment rejected for order=${orderPublicId}`, OrderPlaceFailureTypeEnum.PAYMENT_REJECTED, { available: data.available });
    }
  }

  async refundCustomer({ orderPublicId, buyerPublicId, totalAmount }: OrderPlaceChargeInterface): Promise<void> {
    await this.accounts.refund({ chargeId: orderPublicId, customerPublicId: buyerPublicId, amount: totalAmount });
  }

  @CacheEvict({ key: orderCacheKey })
  @Transactional()
  async markPaid(orderPublicId: string): Promise<void> {
    const paid = await this.orderRepository.updatePendingStatusByPublicId(orderPublicId, OrderStatusEnum.paid);

    if (paid) {
      await this.outbox.create(this.messages.toOrderPaidOutbox(paid));
    }
  }

  @CacheEvict({ key: orderCacheKey })
  @Transactional()
  async markFailed(orderPublicId: string, failure: OrderFailureInterface): Promise<void> {
    const failed = await this.orderRepository.updatePendingStatusByPublicId(orderPublicId, failure.status);

    if (failed) {
      await this.outbox.create(this.messages.toOrderFailedOutbox(failed, failure));
    }
  }
}
