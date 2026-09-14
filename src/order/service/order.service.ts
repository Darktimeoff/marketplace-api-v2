import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
import { BackgroundJobTypeEnum, CurrencyEnum } from '../../entities/enums.js';
import { BackgroundJobService } from '../../background-job/service/background-job.service.js';
import { BackgroundJobCreateInput } from '../../background-job/input/background-job-create.input.js';
import { InsufficientStockProductInterface } from '../interface/insufficient-stock-product.interface.js';
import { InsufficientStockException } from '../exception/insufficient-stock.exception.js';
import { AccountService } from '../../account/service/account.service.js';

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
    private readonly backgroundJobService: BackgroundJobService,
    private readonly offers: ProductOfferService,
    private readonly accounts: AccountService
  ) {}

  @Transactional()
  async create(input: OrderCreateInput): Promise<Order> {
    const orderProductIds = input.items.map(item => item.productOfferId).toSorted()

    const [phone, deliveryAddress, offers] = await Promise.all([
      this.phoneService.create(input.recipient.phone),
      this.deliveryAddressService.create(input.recipient.deliveryAddress),
      this.offers.findByIdsForUpdate(orderProductIds),
    ]);

    const recipient = await this.createRecipient(input.recipient, phone.id, deliveryAddress.id);

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const pricedItems = input.items.map((item) => this.toPriceItemOrFail(item, offersById));

    await this.reserveSellerProducts(offersById, input.items)

    const order = await this.createOrder(recipient.id, pricedItems, input.currency);

    await this.accounts.charge(order.orderRecipient.buyerId, Number(order.totalAmount))

    await this.createItems(pricedItems, order.id);

    await this.backgroundJobService.create(this.toBackgroundJobInput(order))

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

  private toBackgroundJobInput(order: Order): BackgroundJobCreateInput {
    return {
      type: BackgroundJobTypeEnum.ORDER,
      dedupeKey: order.publicId,
      orderId: order.id,
      payload: {}
    }
  }

  private async reserveSellerProducts(offerById: Map<number, ProductOffer>, items: OrderCreateInput['items']) {
    const insufficientProducts: InsufficientStockProductInterface[] = this.getInsufficientProducts(offerById, items)
    if (insufficientProducts.length > 0) {
      throw new InsufficientStockException(insufficientProducts)
    }

    await this.offers.decrementQuantityByIds(items.map(item => ({ id: item.productOfferId, quantity: item.quantity })))
  }

  private getInsufficientProducts(offerById: Map<number, ProductOffer>, items: OrderCreateInput['items']) {
    return items.map<InsufficientStockProductInterface>(item => {
      const offer = offerById.get(item.productOfferId)
      return {
        productOfferId: item.productOfferId,
        requestedQuantity: item.quantity,
        stockQuantity: offer?.quantity ?? null
      }
    }).filter(item => {
      return item.requestedQuantity < (item.stockQuantity ?? 0)
    })
  }
}