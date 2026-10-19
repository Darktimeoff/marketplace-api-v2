import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";
import type { CurrencyEnum } from "@marketplace/contracts-core";

export namespace OrderPaidEvent {
  export const TOPIC = TopicEnum.ORDER_EVENTS;
  export const TYPE = 'order.paid';
  export const SOURCE = SourceEnum.ORDER;

  export interface LineInterface {
    offerId: number;
    quantity: number;
    unitPrice: string;
    unitDiscountPrice: string | null;
  }

  export interface DataInterface {
    orderId: number;
    orderPublicId: string;
    userId: number;
    totalAmount: string;
    discountAmount: string;
    currency: CurrencyEnum;
    lines: LineInterface[];
    paidAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

OrderPaidEvent satisfies MessageContractInterface;
