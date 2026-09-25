import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerOffer } from './entity/seller-offer.entity.js';
import { SellerOfferRepository } from './repository/seller-offer.repository.js';
import { SellerOfferService } from './service/seller-offer.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SellerOffer])],
  providers: [SellerOfferRepository, SellerOfferService],
  exports: [SellerOfferService],
})
export class SellerOfferModule {}
