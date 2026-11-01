import type { AccountCustomerChargeRequest, AccountCustomerRefundRequest } from '@marketplace/messaging-contracts';

export interface AccountClientInterface {
  charge(request: AccountCustomerChargeRequest.DataInterface): Promise<AccountCustomerChargeRequest.ResponseDataType>;
  refund(request: AccountCustomerRefundRequest.DataInterface): Promise<AccountCustomerRefundRequest.ResponseDataType>;
}
