import type { StockReserveRpc } from "@marketplace/messaging-contracts";

type RejectedResponseDataType = Extract<StockReserveRpc.ResponseType, { status: 'rejected' }>;

export class StockReservationRejectedException extends Error {
  constructor(
    readonly reason: RejectedResponseDataType['reason'],
    readonly items: RejectedResponseDataType['items'],
  ) {
    super(`Stock reservation rejected: ${reason}`);
  }
}
