import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { AccountCustomerChargeRequest, AccountCustomerRefundCommand, CLOUD_EVENT_CONTENT_TYPE, StockReleaseCommand, StockReserveRequest } from '@marketplace/messaging-contracts';
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
import { InsufficientStockProductInterface } from '../interface/insufficient-stock-product.interface.js';
import { InsufficientStockException } from '../exception/insufficient-stock.exception.js';
import { BalanceException } from '../exception/balance.exception.js';
import { OrderNotifyService } from '../service/order-notify.service.js';

interface PricedOrderItem {
  item: Omit<OrderProductCreateEntityInterface, 'orderId'>;
  amount: number;
  discount: number;
}

@Injectable()
export class OrderPlaceCommandHandler {
  private readonly logger = new Logger(OrderPlaceCommandHandler.name)

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderRecipientRepository: OrderRecipientRepository,
    private readonly orderProductRepository: OrderProductRepository,
    private readonly phoneService: PhoneService,
    private readonly deliveryAddressService: DeliveryAddressService,
    private readonly offers: SellerOfferService,
    private readonly orderNotify: OrderNotifyService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async execute(input: OrderCreateInput): Promise<Order> {
    const order = await this.createPending(input);
    let isChargeSent = false;

    try {
      await this.reserveStockOrFail(order, input);
      isChargeSent = true;
      await this.chargeOrFail(order, input);
      return await this.markPaid(order);
    } catch (error) {
      if (isChargeSent && !(error instanceof BalanceException)) {
        await this.refundCharge(order, input.recipient.buyerId);
      }

      if (!(error instanceof InsufficientStockException)) {
        await this.releaseStock(order.publicId);
      }

      await this.markFailed(order, error instanceof BalanceException ? OrderStatusEnum.failed_payment : OrderStatusEnum.canceled);
      throw error;
    }
  }

  @Transactional()
  private async createPending(input: OrderCreateInput): Promise<Order> {
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

    return order;
  }

  private async markPaid(order: Order): Promise<Order> {
    const paid = await this.orderRepository.updateStatusById(order.id, OrderStatusEnum.paid);
    this.orderNotify.notifyStatusChanged(paid.id, paid.status);
    return paid;
  }

  private async markFailed(order: Order, status: OrderStatusEnum): Promise<void> {
    try {
      await this.orderRepository.updateStatusById(order.id, status);
      this.orderNotify.notifyStatusChanged(order.id, status);
    } catch (error) {
      this.logger.error(`failed to mark order=${order.publicId} ${status}`, error instanceof Error ? error.stack : String(error));
    }
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
      status: OrderStatusEnum.pending_payment,
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

  private toAccountCustomerRefundCommand(order: Order, customerId: OrderCreateRecipientInput['buyerId']): AccountCustomerRefundCommand.MessageType {
    return {
      specversion: '1.0',
      id: order.publicId,
      source: AccountCustomerRefundCommand.SOURCE,
      type: AccountCustomerRefundCommand.TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: order.publicId,
      correlationid: order.publicId,
      data: { customerId, amount: order.totalAmount, chargeId: order.publicId },
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

  private async reserveStockOrFail(order: Order, input: OrderCreateInput): Promise<void> {
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
  }

  private async chargeOrFail(order: Order, input: OrderCreateInput): Promise<void> {
    const chargeResult = await this.amqpConnection.request<AccountCustomerChargeRequest.ResponseMessageType>({
      exchange: AccountCustomerChargeRequest.TOPIC,
      routingKey: AccountCustomerChargeRequest.TYPE,
      payload: this.toAccountCustomerChargeRequest(order.publicId, input.recipient.buyerId, order.totalAmount),
      timeout: 5000
    })

    if (chargeResult.data.status === 'rejected') { 
      throw new BalanceException(input.recipient.buyerId, Number(chargeResult.data.available), Number(order.totalAmount))
    }
  }

  private async refundCharge(order: Order, customerId: OrderCreateRecipientInput['buyerId']): Promise<void> {
    try {
      await this.amqpConnection.publish(AccountCustomerRefundCommand.TOPIC, AccountCustomerRefundCommand.TYPE, this.toAccountCustomerRefundCommand(order, customerId), {
        contentType: CLOUD_EVENT_CONTENT_TYPE,
      })
    } catch (error) {
      this.logger.error(`failed to refund charge for order=${order.publicId}`, error instanceof Error ? error.stack : String(error));
    }
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
}
