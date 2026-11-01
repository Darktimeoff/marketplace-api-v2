import type { AccountCustomerChargeRpc, AccountCustomerRefundRpc } from '@marketplace/messaging-contracts';

export interface AccountClientInterface {
  charge(request: AccountCustomerChargeRpc.RequestInterface): Promise<AccountCustomerChargeRpc.ResponseType>;
  refund(request: AccountCustomerRefundRpc.RequestInterface): Promise<AccountCustomerRefundRpc.ResponseType>;
}
