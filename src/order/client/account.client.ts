import { Injectable } from '@nestjs/common';
import { AccountCustomerChargeRpc, SourceEnum, TopicEnum, type AccountCustomerRefundRpc } from '@marketplace/messaging-contracts';
import { RabbitMqRpcService } from '../../generic/rabbitmq/rabbitmq-rpc.service.js';
import { AccountCustomerRefundCommandHandler } from '../../account/command-handler/account-customer-refund.command-handler.js';
import type { AccountClientInterface } from './account.client.interface.js';

@Injectable()
export class AccountClient implements AccountClientInterface {
  constructor(
    private readonly rpc: RabbitMqRpcService,
    private readonly customerRefund: AccountCustomerRefundCommandHandler,
  ) {}

  charge(request: AccountCustomerChargeRpc.RequestInterface): Promise<AccountCustomerChargeRpc.ResponseType> {
    return this.rpc.request({
      exchange: TopicEnum.ACCOUNT_COMMANDS,
      method: AccountCustomerChargeRpc.METHOD,
      source: SourceEnum.ORDER,
      id: request.chargeId,
      data: request,
    });
  }

  refund(request: AccountCustomerRefundRpc.RequestInterface): Promise<AccountCustomerRefundRpc.ResponseType> {
    return this.customerRefund.execute(request);
  }
}
