import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";

export namespace ProductCreatedEvent {
  export const TOPIC = TopicEnum.PRODUCT_EVENTS;
  export const TYPE = 'product.created';
  export const SOURCE = SourceEnum.PRODUCT;

  export interface DataInterface {
    productPublicId: string;
    mediaIds: string[];
    createdAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

ProductCreatedEvent satisfies MessageContractInterface;
