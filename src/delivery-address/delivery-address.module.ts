import { Module } from '@nestjs/common';
import { DeliveryAddressRepository } from './repository/delivery-address.repository.js';
import { DeliveryAddressService } from './service/delivery-address.service.js';

@Module({
  providers: [DeliveryAddressRepository, DeliveryAddressService],
  exports: [DeliveryAddressService],
})
export class DeliveryAddressModule {}
