import { AccountCustomerChargeRequest } from "@marketplace/messaging-contracts";

type RejectedResponseDataType = Extract<AccountCustomerChargeRequest.ResponseDataType, { status: 'rejected' }>;

export class AccountCustomerChargeRejectedException extends Error {
  constructor(
    readonly reason: RejectedResponseDataType['reason'],
    readonly amount: number = 0,
    readonly balance: number = 0
  ) {
    super(`Insufficient balance: ${balance} available, ${amount} required`);
  }
}
