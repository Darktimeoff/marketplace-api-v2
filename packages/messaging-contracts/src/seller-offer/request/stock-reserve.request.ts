import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";

export namespace StockReserveRequest {
  export const TOPIC = TopicEnum.SELLER_OFFER_COMMANDS;
  export const TYPE = 'seller-offer.stock.reserve';
  export const RESPONSE_TYPE = 'seller-offer.stock.reserve.response';
  export const SOURCE = '/order-service';
  export const RESPONSE_SOURCE = '/seller-offer-service';

  export interface ItemInterface {
    offerId: number;
    quantity: number;
  }

  export interface DataInterface {
    items: ItemInterface[];
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;

  export type ResponseDataType =
    | { status: 'reserved' }
    | { status: 'rejected'; reason: 'insufficient_stock' | 'offer_not_found'; items: (ItemInterface & { available: number })[] };

  export type ResponseMessageType = CloudEventInterface<typeof RESPONSE_TYPE, ResponseDataType>;
}
