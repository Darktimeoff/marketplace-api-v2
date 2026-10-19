import type { OrderFailedEvent } from '@marketplace/messaging-contracts';

export interface OrderFailureInterface {
  status: OrderFailedEvent.DataInterface['status'];
  reason: OrderFailedEvent.ReasonType;
}
