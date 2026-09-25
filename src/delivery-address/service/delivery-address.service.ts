import { Injectable } from '@nestjs/common';
import { DeliveryAddressRepository } from '../repository/delivery-address.repository.js';
import { DeliveryAddressCreateInput } from '../input/delivery-address-create.input.js';
import { DeliveryAddress } from '../entity/delivery-address.entity.js';

@Injectable()
export class DeliveryAddressService {
  constructor(private readonly deliveryAddressRepository: DeliveryAddressRepository) {}

  /** Всегда создаёт НОВУЮ строку DeliveryAddress — снапшот адреса на момент
   *  заказа, а не ссылку на существующий (см. OrderRecipient.entity.ts). */
  create(input: DeliveryAddressCreateInput): Promise<DeliveryAddress> {
    return this.deliveryAddressRepository.create(input);
  }
}