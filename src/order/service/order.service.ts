import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OrderRepository } from '../repository/order.repository.js';
import { OrderRecipientRepository } from '../repository/order-recipient.repository.js';
import { OrderProductRepository } from '../repository/order-product.repository.js';
import {
  OrderCreateInput,
  OrderCreateItemInput,
  OrderCreateRecipientInput,
} from '../input/order-create.input.js';
import { Order } from '../entity/order.entity.js';
import { OrderRecipient } from '../entity/order-recipient.entity.js';
import { OrderProduct, type OrderProductCreateEntityInterface } from '../entity/order-product.entity.js';
import { PhoneService } from '../../phone/service/phone.service.js';
import { DeliveryAddressService } from '../../delivery-address/service/delivery-address.service.js';
import { ProductOfferService } from '../../product-offer/service/product-offer.service.js';
import { ProductOffer } from '../../entities/product-offer.entity.js';
import { CurrencyEnum } from '../../entities/enums.js';

interface PricedOrderItem {
  item: Omit<OrderProductCreateEntityInterface, 'orderId'>;
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

  @Transactional()
  async create(input: OrderCreateInput): Promise<Order> {
    const [phone, deliveryAddress, offers] = await Promise.all([
      this.phoneService.create(input.recipient.phone),
      this.deliveryAddressService.create(input.recipient.deliveryAddress),
      this.productOfferService.findByIds(input.items.map((item) => item.productOfferId)),
    ]);

    const recipient = await this.createRecipient(input.recipient, phone.id, deliveryAddress.id);

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const pricedItems = input.items.map((item) => this.toPriceItemOrFail(item, offersById));

    const order = await this.createOrder(recipient.id, pricedItems, input.currency);

    await this.createItems(pricedItems, order.id);

    return order;
  }

  private createRecipient(
    recipient: OrderCreateRecipientInput,
    phoneId: number,
    deliveryAddressId: number,
  ): Promise<OrderRecipient> {
    return this.orderRecipientRepository.create({
      buyerId: recipient.buyerId,
      fullName: recipient.fullName,
      phoneId,
      deliveryAddressId,
    });
  }

  private createOrder(
    orderRecipientId: number,
    items: PricedOrderItem[],
    currency: CurrencyEnum,
  ): Promise<Order> {
    const totalAmount = items.reduce((sum, priced) => sum + priced.amount, 0);
    const discountAmount = items.reduce((sum, priced) => sum + priced.discount, 0);

    return this.orderRepository.create({
      orderRecipientId,
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      currency,
    });
  }

  private createItems(pricedItems: PricedOrderItem[], orderId: number): Promise<OrderProduct[]> {
    return this.orderProductRepository.create(
      pricedItems.map((priced) => ({ ...priced.item, orderId })),
    );
  }

  private toPriceItemOrFail(item: OrderCreateItemInput, offersById: Map<number, ProductOffer>): PricedOrderItem {
    const offer = offersById.get(item.productOfferId);
    if (!offer) {
      throw new NotFoundException(`Product with this id ${item.productOfferId} not existed, please try again`)
    }

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