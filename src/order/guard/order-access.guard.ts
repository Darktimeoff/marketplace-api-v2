import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { OrderAccessService } from '../service/order-access.service.js';

@Injectable()
export class OrderAccessGuard implements CanActivate {
  constructor(private readonly orderAccess: OrderAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { id: string };
      query: { buyerPublicId?: string };
      headers: { 'last-event-id'?: string };
    }>();
    const orderId = Number(request.params.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('A valid order id is required');
    }
    const buyerPublicId = request.query.buyerPublicId;
    if (buyerPublicId !== undefined) {
      if (!isUUID(buyerPublicId)) {
        throw new BadRequestException('A valid buyerPublicId query parameter is required');
      }
      await this.orderAccess.canAccess(orderId, buyerPublicId);
    } else {
      await this.orderAccess.canAccess(orderId);
    }

    const lastEventIdValue = request.headers['last-event-id'];
    const lastEventId = lastEventIdValue === undefined ? 0 : Number(lastEventIdValue);
    if (!Number.isSafeInteger(lastEventId) || lastEventId < 0) {
      throw new BadRequestException('Last-Event-ID must be a non-negative safe integer');
    }
    return true;
  }
}
