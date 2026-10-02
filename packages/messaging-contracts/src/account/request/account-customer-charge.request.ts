import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";

export namespace AccountCustomerChargeRequest {
  export const TOPIC = TopicEnum.ACCOUNT_COMMANDS;
  export const TYPE = 'account.customer.charge';
  export const RESPONSE_TYPE = 'account.customer.charge.response';
  export const SOURCE = '/order-service';
  export const RESPONSE_SOURCE = '/account-service';

  export interface DataInterface {
    customerId: number;
    amount: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;

  export type ResponseDataType =
    | { status: 'success' }
    | { status: 'rejected'; reason: 'insufficient_amount' | 'customer_not_found'; available: string };

  export type ResponseMessageType = CloudEventInterface<typeof RESPONSE_TYPE, ResponseDataType>;
}
