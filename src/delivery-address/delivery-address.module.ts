import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryAddress } from '../entities/delivery-address.entity.js';
import { DeliveryAddressRepository } from './repository/delivery-address.repository.js';
import { DeliveryAddressService } from './service/delivery-address.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryAddress])],
  providers: [DeliveryAddressRepository, DeliveryAddressService],
  exports: [DeliveryAddressService],
})
export class DeliveryAddressModule {}
