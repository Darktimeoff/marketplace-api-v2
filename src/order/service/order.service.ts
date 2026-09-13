import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../repository/order.repository.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { Order } from '../entity/order.entity.js';
import { PhoneService } from '../../phone/service/phone.service.js';
import { DeliveryAddressService } from '../../delivery-address/service/delivery-address.service.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly phoneService: PhoneService,
    private readonly deliveryAddressService: DeliveryAddressService,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const [phone, deliveryAddress] = await Promise.all([
      this.phoneService.create(dto.recipient.phone),
      this.deliveryAddressService.create(dto.recipient.deliveryAddress),
    ]);

    return this.orderRepository.create({
      recipient: {
        buyerId: dto.recipient.buyerId,
        fullName: dto.recipient.fullName,
        phoneId: phone.id,
        deliveryAddressId: deliveryAddress.id,
      },
      items: dto.items,
      totalAmount: dto.totalAmount,
      discountAmount: dto.discountAmount,
      currency: dto.currency,
      status: dto.status,
    });
  }
}
