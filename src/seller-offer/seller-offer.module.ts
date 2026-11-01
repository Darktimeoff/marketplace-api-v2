import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerOffer } from './entity/seller-offer.entity.js';
import { StockReservation } from './entity/stock-reservation.entity.js';
import { SellerOfferRepository } from './repository/seller-offer.repository.js';
import { StockReservationRepository } from './repository/stock-reservation.repository.js';
import { SellerOfferService } from './service/seller-offer.service.js';
import { SellerOfferMessage } from './message/seller-offer.message.js';
import { SellerOfferStockReserveCommandHandler } from './command-handler/seller-offer-stock-reserve.command-handler.js';
import { SellerOfferStockReleaseCommandHandler } from './command-handler/seller-offer-stock-release.command-handler.js';

@Module({
  imports: [TypeOrmModule.forFeature([SellerOffer, StockReservation])],
  providers: [SellerOfferRepository, StockReservationRepository, SellerOfferService, SellerOfferMessage, SellerOfferStockReserveCommandHandler, SellerOfferStockReleaseCommandHandler],
  exports: [SellerOfferService, SellerOfferStockReserveCommandHandler, SellerOfferStockReleaseCommandHandler],
})
export class SellerOfferModule {}
