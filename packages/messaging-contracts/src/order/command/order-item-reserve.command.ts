import { OrderCreateItemRequestInterface, SerializedType } from "@marketplace/contracts-core";
import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";

export namespace OrderItemReserveCommand { 
  export const TOPIC = TopicEnum.ORDER_COMMANDS_TOPIC;
  export const TYPE = 'order.item.reserve';
  export const RESPONSE_TYPE = 'order.item.reserve.response'
  export const SOURCE = '/order-service';
  export const RESPONSE_SOURCE = '/seller-offer-service';


  export interface DataInterface
    extends SerializedType<OrderCreateItemRequestInterface[]> {}

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;

  export type ResponseDataInterface = { status: 'reserved'; }
  | { status: 'rejected', reason: 'insufficient_stock' | 'offer_not_found', items: (OrderCreateItemRequestInterface & {available: number})[] }

  export type ResponseMessageType = CloudEventInterface<typeof RESPONSE_TYPE, ResponseDataInterface>;
}