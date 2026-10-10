export class AccountCustomerRefundWithoutChargeException extends Error {
  constructor(readonly chargeId: string) {
    super(`No charge ${chargeId} to refund`);
  }
}
