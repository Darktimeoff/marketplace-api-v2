import { Injectable } from '@nestjs/common';
import type { AccountCustomerChargeRpc, AccountCustomerRefundRpc } from '@marketplace/messaging-contracts';
import { AccountCustomerChargeCommandHandler } from '../../account/command-handler/account-customer-charge.command-handler.js';
import { AccountCustomerRefundCommandHandler } from '../../account/command-handler/account-customer-refund.command-handler.js';
import type { AccountClientInterface } from './account.client.interface.js';

@Injectable()
export class AccountClient implements AccountClientInterface {
  constructor(
    private readonly customerCharge: AccountCustomerChargeCommandHandler,
    private readonly customerRefund: AccountCustomerRefundCommandHandler,
  ) {}

  charge(request: AccountCustomerChargeRpc.RequestInterface): Promise<AccountCustomerChargeRpc.ResponseType> {
    return this.customerCharge.execute(request);
  }

  refund(request: AccountCustomerRefundRpc.RequestInterface): Promise<AccountCustomerRefundRpc.ResponseType> {
    return this.customerRefund.execute(request);
  }
}
