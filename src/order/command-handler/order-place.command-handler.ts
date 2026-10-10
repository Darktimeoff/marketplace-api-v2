import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderRepository } from '../repository/order.repository.js';
import { OrderRecipientRepository } from '../repository/order-recipient.repository.js';
import { OrderLineRepository } from '../repository/order-line.repository.js';
import {
  OrderCreateInput,
  OrderCreateItemInput,
  OrderCreateRecipientInput,
} from '../input/order-create.input.js';
import { Order } from '../entity/order.entity.js';
import { OrderRecipient } from '../entity/order-recipient.entity.js';
import {
  OrderLine,
  type OrderLineCreateEntityInterface,
} from '../entity/order-line.entity.js';
import { SellerOfferService } from '../../seller-offer/service/seller-offer.service.js';
import { SellerOffer } from '../../seller-offer/entity/seller-offer.entity.js';
import { OrderOutboxRepository } from '../repository/order-outbox.repository.js';
import { OrderPlaceMessageService } from '../service/order-place-message.service.js';
import { TemporalClientService } from '../../generic/temporal/temporal-client.service.js';
import { OrderTaskQueueEnum } from '../enum/order-task-queue.enum.js';
import type { orderPlaceWorkflow } from '../workflow/order-place.workflow.js';

interface PricedOrderLine {
  item: Omit<OrderLineCreateEntityInterface, 'orderId'>;
  amount: number;
  discount: number;
}

@Injectable()
export class OrderPlaceCommandHandler {
  private readonly workflowIdPrefix = 'order-place-';

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderRecipientRepository: OrderRecipientRepository,
    private readonly orderLineRepository: OrderLineRepository,
    private readonly offers: SellerOfferService,
    private readonly temporal: TemporalClientService,
    private readonly outbox: OrderOutboxRepository,
    private readonly messages: OrderPlaceMessageService,
  ) {}

  async execute(input: OrderCreateInput): Promise<Order> {
    const order = await this.createPending(input);

    await this.temporal.client.workflow.start<typeof orderPlaceWorkflow>('orderPlaceWorkflow', {
      taskQueue: OrderTaskQueueEnum.ORDER_PLACE,
      workflowId: `${this.workflowIdPrefix}${order.publicId}`,
      args: [this.messages.toOrderPlaceWorkflowInput(order, input.items)],
    });

    return order;
  }

  @Transactional()
  private async createPending(input: OrderCreateInput): Promise<Order> {
    const orderProductIds = input.items
      .map((item) => item.offerId)
      .toSorted();

    const offers = await this.offers.findByIds(orderProductIds);

    const recipient = await this.createRecipient(input.recipient);

    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    const pricedItems = input.items.map((item) =>
      this.toPriceItemOrFail(item, offersById),
    );

    const order = await this.createOrder(
      input.userId,
      recipient.id,
      pricedItems,
      input.currency,
    );

    await this.createItems(pricedItems, order.id);
    await this.outbox.create(this.messages.toOrderCreatedOutbox(order));

    return order;
  }

  private createRecipient(recipient: OrderCreateRecipientInput): Promise<OrderRecipient> {
    return this.orderRecipientRepository.create({
      fullName: recipient.fullName,
      phone: { ...recipient.phone },
      address: {
        addressLine: recipient.address.addressLine,
        city: recipient.address.city,
        building: recipient.address.building ?? null,
      },
    });
  }

  private createOrder(
    userId: Order['userId'],
    orderRecipientId: number,
    items: PricedOrderLine[],
    currency: CurrencyEnum,
  ): Promise<Order> {
    const totalAmount = items.reduce((sum, priced) => sum + priced.amount, 0);
    const discountAmount = items.reduce(
      (sum, priced) => sum + priced.discount,
      0,
    );

    return this.orderRepository.create({
      userId,
      orderRecipientId,
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      currency,
      status: OrderStatusEnum.pending_payment,
    });
  }

  private createItems(
    pricedItems: PricedOrderLine[],
    orderId: number,
  ): Promise<OrderLine[]> {
    return this.orderLineRepository.create(
      pricedItems.map((priced) => ({ ...priced.item, orderId })),
    );
  }

  private toPriceItemOrFail(
    item: OrderCreateItemInput,
    offersById: Map<number, SellerOffer>,
  ): PricedOrderLine {
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
        unitPrice: offer.price,
        unitDiscountPrice: offer.discountPrice,
      },
      amount: discountPrice * item.quantity,
      discount: (price - discountPrice) * item.quantity,
    };
  }
}
