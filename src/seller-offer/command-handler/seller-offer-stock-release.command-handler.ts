import { StockReleaseCommand } from "@marketplace/messaging-contracts";
import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { StockReservationRepository } from "../repository/stock-reservation.repository.js";

@Injectable()
export class SellerOfferStockReleaseCommandHandler {
  constructor(private readonly reservations: StockReservationRepository) {}

  @Transactional()
  execute({ orderPublicId }: StockReleaseCommand.DataInterface): Promise<number> {
    return this.reservations.release(orderPublicId);
  }
}
