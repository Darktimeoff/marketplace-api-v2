import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";

export namespace AccountCustomerRefundCommand {
  export const TOPIC = TopicEnum.ACCOUNT_COMMANDS;
  export const TYPE = 'account.customer.refund';
  export const SOURCE = SourceEnum.ORDER;

  export interface DataInterface {
    customerId: number;
    amount: string;
    chargeId: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

AccountCustomerRefundCommand satisfies MessageContractInterface;
