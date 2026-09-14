import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  DeliveryAddress,
  type DeliveryAddressCreateEntityInterface,
} from '../../entities/delivery-address.entity.js';

@Injectable()
export class DeliveryAddressRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: DeliveryAddressCreateEntityInterface): Promise<DeliveryAddress> {
    const deliveryAddresses = this.txHost.tx.getRepository(DeliveryAddress);
    return deliveryAddresses.save(deliveryAddresses.create(input));
  }
}
