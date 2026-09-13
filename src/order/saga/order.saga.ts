import { Injectable } from "@nestjs/common";
import { Order } from "../entity/order.entity.js";
import { Transactional } from "@nestjs-cls/transactional";
import { OrderRepository } from "../repository/order.repository.js";
import { OrderStatusEnum } from "../../entities/enums.js";
import { ProductOfferService } from "../../product-offer/service/product-offer.service.js";
import { ProductOffer } from "../../entities/product-offer.entity.js";

@Injectable()
export class OrderSaga {
  constructor(
    private readonly repository: OrderRepository,
    private readonly offers: ProductOfferService
  ) {

  }

  @Transactional()
  async handleById(orderId: Order['id']) {
    let order = await this.repository.findByIdOrFail(orderId);
    let hasTransitioned = true;

    while (hasTransitioned) {
      hasTransitioned = await this.processState(order);

      if (hasTransitioned) {
        order = await this.repository.findByIdOrFail(orderId);
      }
    }
  }

  private async processState(order: Order): Promise<boolean> {
    switch (order.status) {
      case OrderStatusEnum.created:
        return await this.handlerCreatedStatus(order);

      case OrderStatusEnum.pending_payment:
      case OrderStatusEnum.failed_payment:
      case OrderStatusEnum.paid:
      case OrderStatusEnum.confirmed:
      case OrderStatusEnum.preparing:
      case OrderStatusEnum.shipped:
      case OrderStatusEnum.delivered:
      case OrderStatusEnum.completed:
      case OrderStatusEnum.canceled:
      case OrderStatusEnum.refunded:
        return false;
    }
  }

  private async handlerCreatedStatus(order: Order): Promise<boolean> {
    const available = await this.reserveItemsInSeller(order)
    if (!available) {
      return false
    }

    await this.repository.updateStatusById(order.id, OrderStatusEnum.pending_payment)
    return true
  }

  private async reserveItemsInSeller(order: Order) {
    const orderProductIds = order.items.map(item => item.productOfferId)
    const offers = await this.offers.findByIdsForUpdate(orderProductIds)

    const offerById = new Map<number, ProductOffer>(offers.map(offer => [offer.id, offer]))
    for (const item of order.items) {
      const offer = offerById.get(item.productOfferId)
      if (!offer) {
        await this.repository.updateStatusById(order.id, OrderStatusEnum.canceled);
        return false
      }

      if (item.quantity > offer.quantity) {
        await this.repository.updateStatusById(order.id, OrderStatusEnum.canceled)
        return false
      }
    }

    try {
      await this.offers.decrementQuantityByIds(
        order.items.map(item => ({ id: item.productOfferId, quantity: item.quantity })),
      )
    } catch {
      await this.repository.updateStatusById(order.id, OrderStatusEnum.canceled)
      return false
    }

    return true
  }
}
