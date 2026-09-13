import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../repository/order.repository.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { Order } from '../entity/order.entity.js';
import { PhoneService } from '../../phone/service/phone.service.js';
import { DeliveryAddressService } from '../../delivery-address/service/delivery-address.service.js';
import { ProductOfferService } from '../../product-offer/service/product-offer.service.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly phoneService: PhoneService,
    private readonly deliveryAddressService: DeliveryAddressService,
    private readonly productOfferService: ProductOfferService,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const [phone, deliveryAddress, offers] = await Promise.all([
      this.phoneService.create(dto.recipient.phone),
      this.deliveryAddressService.create(dto.recipient.deliveryAddress),
      this.productOfferService.findByIds(dto.items.map((item) => item.productOfferId)),
    ]);

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));

    let totalAmount = 0;
    let discountAmount = 0;

    const items = dto.items.map((item) => {
      const offer = offersById.get(item.productOfferId)!;
      const price = Number(offer.price);
      const discountPrice = offer.discountPrice !== null ? Number(offer.discountPrice) : price;

      totalAmount += discountPrice * item.quantity;
      discountAmount += (price - discountPrice) * item.quantity;

      return {
        productOfferId: item.productOfferId,
        quantity: item.quantity,
        price: offer.price,
        discountPrice: offer.discountPrice,
      };
    });

    return this.orderRepository.create({
      recipient: {
        buyerId: dto.recipient.buyerId,
        fullName: dto.recipient.fullName,
        phoneId: phone.id,
        deliveryAddressId: deliveryAddress.id,
      },
      items,
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      currency: dto.currency,
    });
  }
}
