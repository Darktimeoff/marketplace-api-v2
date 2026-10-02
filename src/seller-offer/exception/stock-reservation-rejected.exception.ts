import type { StockReserveRequest } from "@marketplace/messaging-contracts";

type RejectedResponseDataType = Extract<StockReserveRequest.ResponseDataType, { status: 'rejected' }>;

export class StockReservationRejectedException extends Error {
  constructor(
    readonly reason: RejectedResponseDataType['reason'],
    readonly items: RejectedResponseDataType['items'],
  ) {
    super(`Stock reservation rejected: ${reason}`);
  }
}
