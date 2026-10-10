import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ApplicationFailure } from '@temporalio/activity';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { AccountCustomerChargeRequest, AccountCustomerRefundCommand, CLOUD_EVENT_CONTENT_TYPE, StockReleaseCommand, StockReserveRequest } from '@marketplace/messaging-contracts';
import { OrderRepository } from '../repository/order.repository.js';
import { OrderOutboxRepository } from '../repository/order-outbox.repository.js';
import { OrderPlaceMessageService } from '../service/order-place-message.service.js';
import { OrderPlaceFailureTypeEnum } from '../enum/order-place-failure-type.enum.js';
import type { OrderFailureInterface } from '../interface/order-failure.interface.js';
import type {
  OrderPlaceActivitiesInterface,
  OrderPlaceChargeInterface,
  OrderPlaceItemInterface,
} from '../workflow/order-place-workflow.interface.js';

@Injectable()
export class OrderPlaceActivity implements OrderPlaceActivitiesInterface {
  private readonly rpcTimeoutMs = 5000;
  private readonly publishOptions = { contentType: CLOUD_EVENT_CONTENT_TYPE, timeout: 10000 };

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly orderRepository: OrderRepository,
    private readonly outbox: OrderOutboxRepository,
    private readonly messages: OrderPlaceMessageService,
  ) {}

  async reserveStock(orderPublicId: string, items: OrderPlaceItemInterface[]): Promise<void> {
    const { data } = await this.amqpConnection.request<StockReserveRequest.ResponseMessageType>({
      exchange: StockReserveRequest.TOPIC,
      routingKey: StockReserveRequest.TYPE,
      payload: this.messages.toStockReserveRequest(orderPublicId, items),
      timeout: this.rpcTimeoutMs,
    });

    if (data.status === 'rejected') {
      throw ApplicationFailure.nonRetryable(`insufficient stock for order=${orderPublicId}`, OrderPlaceFailureTypeEnum.INSUFFICIENT_STOCK, data.items);
    }
  }

  async releaseStock(orderPublicId: string): Promise<void> {
    await this.amqpConnection.publish(StockReleaseCommand.TOPIC, StockReleaseCommand.TYPE, this.messages.toStockReleaseCommand(orderPublicId), this.publishOptions);
  }

  async chargeCustomer({ orderPublicId, userId, totalAmount }: OrderPlaceChargeInterface): Promise<void> {
    const { data } = await this.amqpConnection.request<AccountCustomerChargeRequest.ResponseMessageType>({
      exchange: AccountCustomerChargeRequest.TOPIC,
      routingKey: AccountCustomerChargeRequest.TYPE,
      payload: this.messages.toAccountCustomerChargeRequest(orderPublicId, userId, totalAmount),
      timeout: this.rpcTimeoutMs,
    });

    if (data.status === 'rejected') {
      throw ApplicationFailure.nonRetryable(`payment rejected for order=${orderPublicId}`, OrderPlaceFailureTypeEnum.PAYMENT_REJECTED, { available: data.available });
    }
  }

  async refundCustomer({ orderPublicId, userId, totalAmount }: OrderPlaceChargeInterface): Promise<void> {
    await this.amqpConnection.publish(AccountCustomerRefundCommand.TOPIC, AccountCustomerRefundCommand.TYPE, this.messages.toAccountCustomerRefundCommand(orderPublicId, userId, totalAmount), this.publishOptions);
  }

  @Transactional()
  async markPaid(orderId: number): Promise<void> {
    const paid = await this.orderRepository.updatePendingStatusById(orderId, OrderStatusEnum.paid);

    if (paid) {
      await this.outbox.create(this.messages.toOrderPaidOutbox(paid));
    }
  }

  @Transactional()
  async markFailed(orderId: number, failure: OrderFailureInterface): Promise<void> {
    const failed = await this.orderRepository.updatePendingStatusById(orderId, failure.status);

    if (failed) {
      await this.outbox.create(this.messages.toOrderFailedOutbox(failed, failure));
    }
  }
}
