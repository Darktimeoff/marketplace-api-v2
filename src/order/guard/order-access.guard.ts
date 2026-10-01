import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { OrderAccessService } from '../service/order-access.service.js';

@Injectable()
export class OrderAccessGuard implements CanActivate {
  constructor(private readonly orderAccess: OrderAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient<Socket>();
      const message = context.switchToWs().getData<{ orderId?: number }>();
      const orderId = Number(message?.orderId);
      const userId = Number(client.handshake.auth?.userId);
      if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isSafeInteger(userId) || userId <= 0) {
        throw new BadRequestException('A valid order id and userId are required');
      }
      await this.orderAccess.canAccess(orderId, userId);
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      params: { id: string };
      query: { userId?: string };
      headers: { 'last-event-id'?: string };
    }>();
    const orderId = Number(request.params.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('A valid order id is required');
    }
    const userIdValue = request.query.userId;
    if (userIdValue !== undefined) {
      const userId = Number(userIdValue);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new BadRequestException('A valid userId query parameter is required');
      }
      await this.orderAccess.canAccess(orderId, userId);
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
