import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerOffer } from './entity/seller-offer.entity.js';
import { StockReservation } from './entity/stock-reservation.entity.js';
import { SellerOfferRepository } from './repository/seller-offer.repository.js';
import { StockReservationRepository } from './repository/stock-reservation.repository.js';
import { SellerOfferService } from './service/seller-offer.service.js';
import { SellerOfferTopologyService } from './service/seller-offer-topology.service.js';
import { OrderSellerOfferGateway } from './controller/order-seller-offer.gateway.js';
import { RabbitMqModule } from '../generic/rabbitmq/rabbitmq.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([SellerOffer, StockReservation]), RabbitMqModule],
  providers: [SellerOfferRepository, StockReservationRepository, SellerOfferService, SellerOfferTopologyService, OrderSellerOfferGateway],
  exports: [SellerOfferService],
})
export class SellerOfferModule {}
