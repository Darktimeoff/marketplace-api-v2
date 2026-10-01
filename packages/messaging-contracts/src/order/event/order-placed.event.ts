import type { OrderEntityInterface, SerializedType } from '@marketplace/contracts-core';
import type { CloudEventInterface } from '../../generic/interface/cloud-event.interface.js';
import type { MessageContractInterface } from '../../generic/interface/message-contract.interface.js';

export namespace OrderPlacedEvent {
  export const TOPIC = 'order.events';
  export const TYPE = 'order.placed';
  export const SOURCE = '/order-service';

  export interface DataInterface
    extends SerializedType<
      Pick<
        OrderEntityInterface,
        'id' | 'publicId' | 'status' | 'currency' | 'totalAmount' | 'discountAmount' | 'createdAt' | 'updatedAt'
      >
    > {}

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

OrderPlacedEvent satisfies MessageContractInterface;
