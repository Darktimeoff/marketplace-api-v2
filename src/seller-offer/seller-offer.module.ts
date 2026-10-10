import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerOffer } from './entity/seller-offer.entity.js';
import { StockReservation } from './entity/stock-reservation.entity.js';
import { SellerOfferRepository } from './repository/seller-offer.repository.js';
import { StockReservationRepository } from './repository/stock-reservation.repository.js';
import { SellerOfferService } from './service/seller-offer.service.js';
import { SellerOfferTopologyService } from './service/seller-offer-topology.service.js';
import { SellerOfferGateway } from './gateway/seller-offer.gateway.js';
import { SellerOfferStockReserveCommandHandler } from './command-handler/seller-offer-stock-reserve.command-handler.js';
import { SellerOfferStockReleaseCommandHandler } from './command-handler/seller-offer-stock-release.command-handler.js';
import { RabbitMqModule } from '../generic/rabbitmq/rabbitmq.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([SellerOffer, StockReservation]), RabbitMqModule],
  providers: [SellerOfferRepository, StockReservationRepository, SellerOfferService, SellerOfferTopologyService, SellerOfferStockReserveCommandHandler, SellerOfferStockReleaseCommandHandler, SellerOfferGateway],
  exports: [SellerOfferService],
})
export class SellerOfferModule {}
