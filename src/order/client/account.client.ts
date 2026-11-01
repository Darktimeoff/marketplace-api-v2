import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AccountCustomerChargeRequest, AccountCustomerRefundRequest } from '@marketplace/messaging-contracts';
import { OrderPlaceMessage } from '../message/order-place.message.js';
import type { AccountClientInterface } from './account.client.interface.js';

@Injectable()
export class AccountClient implements AccountClientInterface {
  private readonly rpcTimeoutMs = 5000;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly messages: OrderPlaceMessage,
  ) {}

  async charge(request: AccountCustomerChargeRequest.DataInterface): Promise<AccountCustomerChargeRequest.ResponseDataType> {
    const { data } = await this.amqpConnection.request<AccountCustomerChargeRequest.ResponseMessageType>({
      exchange: AccountCustomerChargeRequest.TOPIC,
      routingKey: AccountCustomerChargeRequest.TYPE,
      payload: this.messages.toAccountCustomerChargeRequest(request),
      timeout: this.rpcTimeoutMs,
      expiration: this.rpcTimeoutMs,
    });

    return data;
  }

  async refund(request: AccountCustomerRefundRequest.DataInterface): Promise<AccountCustomerRefundRequest.ResponseDataType> {
    const { data } = await this.amqpConnection.request<AccountCustomerRefundRequest.ResponseMessageType>({
      exchange: AccountCustomerRefundRequest.TOPIC,
      routingKey: AccountCustomerRefundRequest.TYPE,
      payload: this.messages.toAccountCustomerRefundRequest(request),
      timeout: this.rpcTimeoutMs,
      expiration: this.rpcTimeoutMs,
    });

    return data;
  }
}
