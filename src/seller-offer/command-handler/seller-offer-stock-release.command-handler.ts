import { StockReleaseRpc } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { StockReservationRepository } from "../repository/stock-reservation.repository.js";

@Injectable()
export class SellerOfferStockReleaseCommandHandler {
  private readonly logger = new Logger(SellerOfferStockReleaseCommandHandler.name)

  constructor(private readonly reservations: StockReservationRepository) {}

  @Transactional()
  async execute({ orderPublicId }: StockReleaseRpc.RequestInterface): Promise<StockReleaseRpc.ResponseType> {
    const released = await this.reservations.release(orderPublicId);
    this.logger.log(`released order=${orderPublicId} offers=${released}`);
    return { status: 'released', offers: released };
  }
}
