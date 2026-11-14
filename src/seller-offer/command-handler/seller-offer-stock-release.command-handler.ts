import { StockReleaseRpc } from "@marketplace/messaging-contracts";
import { Injectable } from "@nestjs/common";
import { Log } from "../../generic/logging/decorator/log.decorator.js";
import { Transactional } from "@nestjs-cls/transactional";
import { StockReservationRepository } from "../repository/stock-reservation.repository.js";

@Injectable()
export class SellerOfferStockReleaseCommandHandler {

  constructor(private readonly reservations: StockReservationRepository) {}

  @Log(undefined, (response, request) => `released order=${request.orderPublicId} offers=${response.offers}`)
  @Transactional()
  async execute({ orderPublicId }: StockReleaseRpc.RequestInterface): Promise<StockReleaseRpc.ResponseType> {
    return { status: 'released', offers: await this.reservations.release(orderPublicId) };
  }
}
