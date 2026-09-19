import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductOffer } from '../entities/product-offer.entity.js';
import { ProductOfferRepository } from './repository/product-offer.repository.js';
import { ProductOfferService } from './service/product-offer.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProductOffer])],
  providers: [ProductOfferRepository, ProductOfferService],
  exports: [ProductOfferService],
})
export class ProductOfferModule {}
