import type { OrderEntityInterface } from '../entity/order-entity.interface.js';

export interface OrderResponseInterface
  extends Pick<
    OrderEntityInterface,
    'id' | 'publicId' | 'status' | 'totalAmount' | 'discountAmount' | 'currency' | 'createdAt' | 'updatedAt'
  > {}
