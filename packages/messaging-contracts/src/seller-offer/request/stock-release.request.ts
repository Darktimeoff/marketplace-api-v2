import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";

export namespace StockReleaseRequest {
  export const TOPIC = TopicEnum.SELLER_OFFER_COMMANDS;
  export const TYPE = 'seller-offer.stock.release';
  export const RESPONSE_TYPE = 'seller-offer.stock.release.response';
  export const SOURCE = SourceEnum.ORDER;
  export const RESPONSE_SOURCE = SourceEnum.SELLER_OFFER;

  export interface DataInterface {
    orderPublicId: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;

  export type ResponseDataType = { status: 'released'; offers: number };

  export type ResponseMessageType = CloudEventInterface<typeof RESPONSE_TYPE, ResponseDataType>;
}
