import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CurrencyEnum, OrderStatusEnum, type OrderResponseInterface } from '@marketplace/contracts-core';
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
import type { SellerOfferPriceRpc } from '@marketplace/messaging-contracts';
import { SELLER_OFFER_CLIENT } from '../constant/order-client.constant.js';
import type { SellerOfferClientInterface } from '../client/seller-offer.client.interface.js';
import { OrderOutboxRepository } from '../repository/order-outbox.repository.js';
import { OrderPlaceMessage } from '../message/order-place.message.js';
import { OrderResponse } from '../response/order.response.js';
import { OrderWorkflowOutboxRepository } from '../repository/order-workflow-outbox.repository.js';
import { OrderBuyerRepository } from '../repository/order-buyer.repository.js';
import type { OrderBuyer } from '../entity/order-buyer.entity.js';

interface PricedOrderLine {
  item: Omit<OrderLineCreateEntityInterface, 'orderId'>;
  amount: number;
  discount: number;
}

@Injectable()
export class OrderPlaceCommandHandler {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderRecipientRepository: OrderRecipientRepository,
    private readonly orderLineRepository: OrderLineRepository,
    @Inject(SELLER_OFFER_CLIENT) private readonly sellerOffers: SellerOfferClientInterface,
    private readonly outbox: OrderOutboxRepository,
    private readonly workflowOutbox: OrderWorkflowOutboxRepository,
    private readonly buyers: OrderBuyerRepository,
    private readonly messages: OrderPlaceMessage,
    private readonly responses: OrderResponse,
  ) {}

  async execute(input: OrderCreateInput, identityPublicId: string, idempotencyKey: string | null = null): Promise<OrderResponseInterface> {
    const buyer = await this.buyers.findByPublicId(identityPublicId);

    if (!buyer) {
      throw new ConflictException('Buyer account is still being set up, try again shortly');
    }

    return this.responses.toOrder(await this.createPending(input, buyer, idempotencyKey));
  }

  @Transactional()
  private async createPending(input: OrderCreateInput, buyer: OrderBuyer, idempotencyKey: string | null): Promise<Order> {
    if (idempotencyKey) {
      await this.orderRepository.lockIdempotencyKey(buyer.id, idempotencyKey);
      const placed = await this.orderRepository.findByIdempotencyKey(buyer.id, idempotencyKey);

      if (placed) {
        return placed;
      }
    }

    const { offers } = await this.sellerOffers.findPrices({ offerPublicIds: input.items.map((item) => item.offerPublicId) });

    const recipient = await this.createRecipient(input.recipient);

    const offersByPublicId = new Map(offers.map((offer) => [offer.offerPublicId, offer]));
    const pricedItems = input.items.map((item) =>
      this.toPriceItemOrFail(item, offersByPublicId),
    );

    const order = await this.createOrder(
      buyer,
      recipient.id,
      pricedItems,
      input.currency,
      idempotencyKey,
    );

    await this.createItems(pricedItems, order.id);
    await this.outbox.create(this.messages.toOrderCreatedOutbox(order, buyer));
    await this.workflowOutbox.create(this.messages.toOrderPlaceWorkflowOutbox(order, buyer, input.items));

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
    buyer: OrderBuyer,
    orderRecipientId: number,
    items: PricedOrderLine[],
    currency: CurrencyEnum,
    idempotencyKey: string | null,
  ): Promise<Order> {
    const totalAmount = items.reduce((sum, priced) => sum + priced.amount, 0);
    const discountAmount = items.reduce(
      (sum, priced) => sum + priced.discount,
      0,
    );

    return this.orderRepository.create({
      buyerId: buyer.id,
      orderRecipientId,
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      currency,
      status: OrderStatusEnum.pending_payment,
      idempotencyKey,
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
    offersByPublicId: Map<string, SellerOfferPriceRpc.OfferPriceInterface>,
  ): PricedOrderLine {
    const offer = offersByPublicId.get(item.offerPublicId);
    if (!offer) {
      throw new NotFoundException(
        `Product with this id ${item.offerPublicId} not existed, please try again`,
      );
    }

    const price = Number(offer.price);
    const discountPrice =
      offer.discountPrice !== null ? Number(offer.discountPrice) : price;

    return {
      item: {
        offerPublicId: item.offerPublicId,
        quantity: item.quantity,
        unitPrice: offer.price,
        unitDiscountPrice: offer.discountPrice,
      },
      amount: discountPrice * item.quantity,
      discount: (price - discountPrice) * item.quantity,
    };
  }
}
