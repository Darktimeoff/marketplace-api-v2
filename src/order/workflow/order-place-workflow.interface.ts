import type { OrderFailureInterface } from '../interface/order-failure.interface.js';

export interface OrderPlaceItemInterface {
  offerId: number;
  quantity: number;
}

export interface OrderPlaceWorkflowInputInterface {
  orderId: number;
  orderPublicId: string;
  userId: number;
  totalAmount: string;
  items: OrderPlaceItemInterface[];
}

export interface OrderPlaceChargeInterface {
  orderPublicId: string;
  userId: number;
  totalAmount: string;
}

export interface OrderPlaceActivitiesInterface {
  reserveStock(orderPublicId: string, items: OrderPlaceItemInterface[]): Promise<void>;
  releaseStock(orderPublicId: string): Promise<void>;
  chargeCustomer(charge: OrderPlaceChargeInterface): Promise<void>;
  refundCustomer(charge: OrderPlaceChargeInterface): Promise<void>;
  markPaid(orderId: number): Promise<void>;
  markFailed(orderId: number, failure: OrderFailureInterface): Promise<void>;
}
