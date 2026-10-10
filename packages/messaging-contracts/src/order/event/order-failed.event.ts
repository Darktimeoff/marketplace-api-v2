import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";
import type { OrderStatusEnum } from "@marketplace/contracts-core";

export namespace OrderFailedEvent {
  export const TOPIC = TopicEnum.ORDER_EVENTS;
  export const TYPE = 'order.failed';
  export const SOURCE = SourceEnum.ORDER;

  export type ReasonType = 'insufficient_stock' | 'payment_rejected' | 'error';

  export interface DataInterface {
    orderId: number;
    orderPublicId: string;
    userId: number;
    status: OrderStatusEnum.canceled | OrderStatusEnum.failed_payment;
    reason: ReasonType;
    failedAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

OrderFailedEvent satisfies MessageContractInterface;
