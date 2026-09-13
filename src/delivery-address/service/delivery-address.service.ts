import { Injectable } from '@nestjs/common';
import { DeliveryAddressRepository } from '../repository/delivery-address.repository.js';
import { CreateDeliveryAddressDto } from '../dto/create-delivery-address.dto.js';
import { DeliveryAddress } from '../../entities/delivery-address.entity.js';

@Injectable()
export class DeliveryAddressService {
  constructor(private readonly deliveryAddressRepository: DeliveryAddressRepository) {}

  /** Всегда создаёт НОВУЮ строку DeliveryAddress — снапшот адреса на момент
   *  заказа, а не ссылку на существующий (см. OrderRecipient.entity.ts). */
  create(dto: CreateDeliveryAddressDto): Promise<DeliveryAddress> {
    return this.deliveryAddressRepository.create(dto);
  }
}
