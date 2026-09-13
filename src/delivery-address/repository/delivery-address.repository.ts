import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { DeliveryAddress } from '../../entities/delivery-address.entity.js';
import { CreateDeliveryAddressDto } from '../dto/create-delivery-address.dto.js';

@Injectable()
export class DeliveryAddressRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(dto: CreateDeliveryAddressDto): Promise<DeliveryAddress> {
    const deliveryAddresses = this.txHost.tx.getRepository(DeliveryAddress);
    return deliveryAddresses.save(deliveryAddresses.create(dto));
  }
}
