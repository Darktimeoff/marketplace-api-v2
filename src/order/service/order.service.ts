import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../repository/order.repository.js';
import { OrderRecipientRepository } from '../repository/order-recipient.repository.js';
import { OrderProductRepository, CreateOrderProductInput } from '../repository/order-product.repository.js';
import { CreateOrderDto, CreateOrderItemDto } from '../dto/create-order.dto.js';
import { Order } from '../entity/order.entity.js';
import { PhoneService } from '../../phone/service/phone.service.js';
import { DeliveryAddressService } from '../../delivery-address/service/delivery-address.service.js';
import { ProductOfferService } from '../../product-offer/service/product-offer.service.js';
import { ProductOffer } from '../../entities/product-offer.entity.js';

interface PricedOrderItem {
  item: Omit<CreateOrderProductInput, 'orderId'>;
  amount: number;
  discount: number;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderRecipientRepository: OrderRecipientRepository,
    private readonly orderProductRepository: OrderProductRepository,
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

    const recipient = await this.orderRecipientRepository.create({
      buyerId: dto.recipient.buyerId,
      fullName: dto.recipient.fullName,
      phoneId: phone.id,
      deliveryAddressId: deliveryAddress.id,
    });

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const pricedItems = dto.items.map((item) => this.priceItem(item, offersById));

    const totalAmount = pricedItems.reduce((sum, priced) => sum + priced.amount, 0);
    const discountAmount = pricedItems.reduce((sum, priced) => sum + priced.discount, 0);

    const order = await this.orderRepository.create({
      orderRecipientId: recipient.id,
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      currency: dto.currency,
    });

    await this.orderProductRepository.create(
      pricedItems.map((priced) => ({ ...priced.item, orderId: order.id })),
    );

    return order;
  }

  private priceItem(item: CreateOrderItemDto, offersById: Map<number, ProductOffer>): PricedOrderItem {
    const offer = offersById.get(item.productOfferId)!;
    const price = Number(offer.price);
    const discountPrice = offer.discountPrice !== null ? Number(offer.discountPrice) : price;

    return {
      item: {
        productOfferId: item.productOfferId,
        quantity: item.quantity,
        price: offer.price,
        discountPrice: offer.discountPrice,
      },
      amount: discountPrice * item.quantity,
      discount: (price - discountPrice) * item.quantity,
    };
  }
}
