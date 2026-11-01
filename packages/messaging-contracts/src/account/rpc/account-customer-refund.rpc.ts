export namespace AccountCustomerRefundRpc {
  export const METHOD = 'account.customer.refund';

  export interface RequestInterface {
    chargeId: string;
    customerPublicId: string;
    amount: string;
  }

  export type ResponseType =
    | { status: 'refunded' }
    | { status: 'not_charged' };
}
