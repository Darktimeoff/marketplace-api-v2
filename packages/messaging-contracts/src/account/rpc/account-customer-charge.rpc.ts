export namespace AccountCustomerChargeRpc {
  export const METHOD = 'account.customer.charge';

  export interface RequestInterface {
    chargeId: string;
    customerPublicId: string;
    amount: string;
  }

  export type ResponseType =
    | { status: 'success' }
    | { status: 'rejected'; reason: 'insufficient_amount' | 'customer_not_found'; available: string };
}
