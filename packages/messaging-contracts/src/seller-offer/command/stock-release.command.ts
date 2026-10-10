import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";

export namespace StockReleaseCommand {
  export const TOPIC = TopicEnum.SELLER_OFFER_COMMANDS;
  export const TYPE = 'seller-offer.stock.release';
  export const SOURCE = SourceEnum.ORDER;

  export interface DataInterface {
    orderPublicId: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

StockReleaseCommand satisfies MessageContractInterface;
