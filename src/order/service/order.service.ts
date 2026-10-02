import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EntityNotFoundError } from 'typeorm';
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
import {
  OrderProduct,
  type OrderProductCreateEntityInterface,
} from '../entity/order-product.entity.js';
import { PhoneService } from '../../phone/service/phone.service.js';
import { DeliveryAddressService } from '../../delivery-address/service/delivery-address.service.js';
import { SellerOfferService } from '../../seller-offer/service/seller-offer.service.js';
import { SellerOffer } from '../../seller-offer/entity/seller-offer.entity.js';
import { BackgroundJobTypeEnum } from '../../generic/enum/enums.js';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { BackgroundJobService } from '../../background-job/service/background-job.service.js';
import { BackgroundJobCreateInput } from '../../background-job/input/background-job-create.input.js';
import { InsufficientStockProductInterface } from '../interface/insufficient-stock-product.interface.js';
import { InsufficientStockException } from '../exception/insufficient-stock.exception.js';
import { OrderNotifyService } from './order-notify.service.js';
import { OrderAccessService } from './order-access.service.js';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { AccountCustomerChargeRequest, CLOUD_EVENT_CONTENT_TYPE, OrderPlacedEvent, StockReleaseCommand, StockReserveRequest } from '@marketplace/messaging-contracts';
import { BalanceException } from '../exception/balance.exception.js';

interface PricedOrderItem {
  item: Omit<OrderProductCreateEntityInterface, 'orderId'>;
  amount: number;
  discount: number;
}

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name)
  
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderRecipientRepository: OrderRecipientRepository,
    private readonly orderProductRepository: OrderProductRepository,
    private readonly phoneService: PhoneService,
    private readonly deliveryAddressService: DeliveryAddressService,
    private readonly backgroundJobService: BackgroundJobService,
    private readonly offers: SellerOfferService,
    private readonly orderNotify: OrderNotifyService,
    private readonly orderAccess: OrderAccessService,
    private readonly amqpConnection: AmqpConnection
  ) { }

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
        channel.on('return', (msg: ConsumeMessage) => {
          this.logger.error(`unroutable ${msg.fields.exchange}/${msg.fields.routingKey}`);
        });
      });
  }

  @Transactional()
  async create(input: OrderCreateInput): Promise<Order> {
    const orderProductIds = input.items
      .map((item) => item.offerId)
      .toSorted();

    const phone = await this.phoneService.create(input.recipient.phone);
    const deliveryAddress = await this.deliveryAddressService.create(
      input.recipient.deliveryAddress,
    );
    const offers = await this.offers.findByIds(orderProductIds);

    const recipient = await this.createRecipient(
      input.recipient,
      phone.id,
      deliveryAddress.id,
    );

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const pricedItems = input.items.map((item) =>
      this.toPriceItemOrFail(item, offersById),
    );

    const order = await this.createOrder(
      recipient.id,
      pricedItems,
      input.currency,
    );

    await this.createItems(pricedItems, order.id);

    try {
      await this.reserveChargeAndPublish(order, input);
    } catch (error) {
      if (!(error instanceof InsufficientStockException)) {
        await this.releaseStock(order.publicId);
      }

      throw error;
    }

    return order;
  }

  private async reserveChargeAndPublish(order: Order, input: OrderCreateInput): Promise<void> {
    const { data: result } = await this.amqpConnection.request<StockReserveRequest.ResponseMessageType>({
      exchange: StockReserveRequest.TOPIC,
      routingKey: StockReserveRequest.TYPE,
      payload: this.toStockReserveRequest(order.publicId, input.items),
      timeout: 5000
    })

    if (result.status === 'rejected') {
      throw new InsufficientStockException(
        result.items.map<InsufficientStockProductInterface>((item) => ({
          offerId: item.offerId,
          requestedQuantity: item.quantity,
          stockQuantity: item.available,
        })),
      );
    }

    const chargeResult = await this.amqpConnection.request<AccountCustomerChargeRequest.ResponseMessageType>({
      exchange: AccountCustomerChargeRequest.TOPIC,
      routingKey: AccountCustomerChargeRequest.TYPE,
      payload: this.toAccountCustomerChargeRequest(order.publicId, input.recipient.buyerId, order.totalAmount),
      timeout: 5000
    })

    if (chargeResult.data.status === 'rejected') { 
      throw new BalanceException(input.recipient.buyerId, Number(chargeResult.data.available), Number(order.totalAmount))
    }
    
    await this.backgroundJobService.create(this.toBackgroundJobInput(order));
    await this.amqpConnection.publish(OrderPlacedEvent.TOPIC, OrderPlacedEvent.TYPE, this.toOrderPlacedEvent(order), {
      contentType: CLOUD_EVENT_CONTENT_TYPE,
    })
  }

  private async releaseStock(orderPublicId: string): Promise<void> {
    try {
      await this.amqpConnection.publish(StockReleaseCommand.TOPIC, StockReleaseCommand.TYPE, this.toStockReleaseCommand(orderPublicId), {
        contentType: CLOUD_EVENT_CONTENT_TYPE,
      })
    } catch (error) {
      this.logger.error(`failed to release stock for order=${orderPublicId}`, error instanceof Error ? error.stack : String(error));
    }
  }

  async findById(id: Order['id']): Promise<Order> {
    try {
      return await this.orderRepository.findByIdOrFail(id);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }

      throw error;
    }
  }

  async updateStatus(
    orderId: number,
    userId: number,
    status: OrderStatusEnum,
  ): Promise<Order> {
    await this.orderAccess.canAccess(orderId, userId);
    const updatedOrder = await this.orderRepository.updateStatusById(orderId, status);
    this.orderNotify.notifyStatusChanged(orderId, status);
    return updatedOrder;
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
    const discountAmount = items.reduce(
      (sum, priced) => sum + priced.discount,
      0,
    );

    return this.orderRepository.create({
      orderRecipientId,
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      currency,
    });
  }

  private createItems(
    pricedItems: PricedOrderItem[],
    orderId: number,
  ): Promise<OrderProduct[]> {
    return this.orderProductRepository.create(
      pricedItems.map((priced) => ({ ...priced.item, orderId })),
    );
  }

  private toPriceItemOrFail(
    item: OrderCreateItemInput,
    offersById: Map<number, SellerOffer>,
  ): PricedOrderItem {
    const offer = offersById.get(item.offerId);
    if (!offer) {
      throw new NotFoundException(
        `Product with this id ${item.offerId} not existed, please try again`,
      );
    }

    const price = Number(offer.price);
    const discountPrice =
      offer.discountPrice !== null ? Number(offer.discountPrice) : price;

    return {
      item: {
        offerId: item.offerId,
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
      payload: {},
    };
  }

  private toOrderPlacedEvent(order: Order): OrderPlacedEvent.MessageType {
    return {
      specversion: '1.0',
      id: order.publicId,
      source: OrderPlacedEvent.SOURCE,
      type: OrderPlacedEvent.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: order.publicId,
      correlationid: order.publicId,
      data: {
        id: order.id,
        publicId: order.publicId,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        status: order.status,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString()
      },
    }
  }

  private toStockReleaseCommand(orderPublicId: string): StockReleaseCommand.MessageType {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: StockReleaseCommand.SOURCE,
      type: StockReleaseCommand.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: orderPublicId,
      correlationid: orderPublicId,
      data: { orderPublicId },
    }
  }

  private toStockReserveRequest(id: string, items: OrderCreateInput['items']): StockReserveRequest.MessageType {
    return {
      specversion: '1.0',
      id,
      source: StockReserveRequest.SOURCE,
      type: StockReserveRequest.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: id,
      correlationid: id,
      data: { items: items.map(({ offerId, quantity }) => ({ offerId, quantity })) },
    }
  }

  private toAccountCustomerChargeRequest(id: string, customerId: OrderCreateRecipientInput['buyerId'], amount: string): AccountCustomerChargeRequest.MessageType {
    return {
      specversion: '1.0',
      id,
      source: AccountCustomerChargeRequest.SOURCE,
      type: AccountCustomerChargeRequest.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: id,
      correlationid: id,
      data: { customerId, amount  },
    }
  }
}
