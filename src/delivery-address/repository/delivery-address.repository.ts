import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryAddress } from '../../entities/delivery-address.entity.js';
import { CreateDeliveryAddressDto } from '../dto/create-delivery-address.dto.js';

@Injectable()
export class DeliveryAddressRepository {
  constructor(
    @InjectRepository(DeliveryAddress) private readonly deliveryAddresses: Repository<DeliveryAddress>,
  ) {}

  create(dto: CreateDeliveryAddressDto): Promise<DeliveryAddress> {
    return this.deliveryAddresses.save(this.deliveryAddresses.create(dto));
  }
}
