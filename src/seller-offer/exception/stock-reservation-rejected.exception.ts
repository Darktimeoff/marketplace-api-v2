import type { OrderItemReserveCommand } from "@marketplace/messaging-contracts";

type RejectedResponseDataType = Extract<OrderItemReserveCommand.ResponseDataInterface, { status: 'rejected' }>;

export class StockReservationRejectedException extends Error {
  constructor(
    readonly reason: RejectedResponseDataType['reason'],
    readonly items: RejectedResponseDataType['items'],
  ) {
    super(`Stock reservation rejected: ${reason}`);
  }
}
