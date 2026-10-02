import type { StockReservationStatusEnum } from '../enum/stock-reservation-status.enum.js';

export interface StockReservationEntityInterface {
  orderPublicId: string;
  offerId: number;
  quantity: number;
  status: StockReservationStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}
