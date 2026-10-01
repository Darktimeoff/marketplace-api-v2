import type { OrderEntityInterface } from '../entity/order-entity.interface.js';

export interface OrderResponse
  extends Pick<
    OrderEntityInterface,
    'id' | 'publicId' | 'status' | 'totalAmount' | 'discountAmount' | 'currency' | 'createdAt' | 'updatedAt'
  > {}
