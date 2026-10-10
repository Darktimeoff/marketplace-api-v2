import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";
import type { CurrencyEnum } from "@marketplace/contracts-core";

export namespace OrderCreatedEvent {
  export const TOPIC = TopicEnum.ORDER_EVENTS;
  export const TYPE = 'order.created';
  export const SOURCE = SourceEnum.ORDER;

  export interface DataInterface {
    orderId: number;
    orderPublicId: string;
    userId: number;
    totalAmount: string;
    discountAmount: string;
    currency: CurrencyEnum;
    createdAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

OrderCreatedEvent satisfies MessageContractInterface;
