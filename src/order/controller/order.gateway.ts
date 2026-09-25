import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { OrderAccessService } from '../service/order-access.service.js';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { OrderAccessGuard } from '../guard/order-access.guard.js';
import { OrderNotifyService } from '../service/order-notify.service.js';

interface JoinOrderMessage {
  orderId: number;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private eventSubscription: Subscription;

  constructor(
    private readonly orderNotify: OrderNotifyService,
    private readonly orderAccess: OrderAccessService,
  ) {}

  afterInit(): void {
    this.eventSubscription = this.orderNotify.events$.subscribe((event) => {
      this.server.to(`orders:${event.orderId}`).emit('order.status', event);
    });
  }

  handleConnection(client: Socket): void {
    if (!Number.isSafeInteger(Number(client.handshake.auth?.userId)) || Number(client.handshake.auth?.userId) <= 0) {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {}

  onModuleDestroy(): void {
    this.eventSubscription?.unsubscribe();
  }

  @UseGuards(OrderAccessGuard)
  @SubscribeMessage('join')
  async joinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: JoinOrderMessage,
  ): Promise<{ joined: boolean }> {
    const orderId = Number(message.orderId);
    await client.join(`orders:${orderId}`);
    return { joined: true };
  }
}
