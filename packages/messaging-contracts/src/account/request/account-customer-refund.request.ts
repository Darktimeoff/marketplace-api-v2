import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";

export namespace AccountCustomerRefundRequest {
  export const TOPIC = TopicEnum.ACCOUNT_COMMANDS;
  export const TYPE = 'account.customer.refund';
  export const RESPONSE_TYPE = 'account.customer.refund.response';
  export const SOURCE = SourceEnum.ORDER;
  export const RESPONSE_SOURCE = SourceEnum.ACCOUNT;

  export interface DataInterface {
    customerId: number;
    amount: string;
    chargeId: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;

  export type ResponseDataType =
    | { status: 'refunded' }
    | { status: 'not_charged' };

  export type ResponseMessageType = CloudEventInterface<typeof RESPONSE_TYPE, ResponseDataType>;
}
