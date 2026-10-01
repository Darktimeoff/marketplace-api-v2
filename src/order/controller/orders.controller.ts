import { Body, Controller, Headers, MessageEvent, Param, ParseIntPipe, Patch, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OrderService } from '../service/order.service.js';
import { OrderAccessGuard } from '../guard/order-access.guard.js';
import { OrderStatusUpdateInput } from '../input/order-status-update.input.js';
import { OrderDto } from '../dto/order.dto.js';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { OrderStatusEvent } from '../interface/order-status-event.interface.js';
import { OrderNotifyService } from '../service/order-notify.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderNotify: OrderNotifyService,
  ) {}

  @UseGuards(OrderAccessGuard)
  @ResponseDto(OrderDto)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: OrderStatusUpdateInput,
  ): Promise<OrderDto> {
    return this.orderService.updateStatus(id, input.userId, input.status);
  }

  @UseGuards(OrderAccessGuard)
  @Sse(':id/events')
  events(
    @Param('id', ParseIntPipe) id: number,
    @Headers('Last-Event-ID') lastEventIdHeader: string | undefined,
  ): Observable<MessageEvent> {
    const lastEventId = lastEventIdHeader === undefined ? 0 : Number(lastEventIdHeader);

    return new Observable<MessageEvent>((subscriber) => {
      let lastSentId = lastEventId;
      
      const emitEvent = (event: OrderStatusEvent): void => {
        lastSentId = this.writeEvent(subscriber, event, lastSentId);
      };
      
      const unsubscribe = this.orderNotify.subscribe(id, emitEvent);
      subscriber.next({ comment: 'connected' });

      for (const event of this.orderNotify.getAfter(id, lastEventId)) {
        emitEvent(event);
      }
      return unsubscribe;
    });
  }

  private writeEvent(
    subscriber: { next: (event: MessageEvent) => void },
    event: OrderStatusEvent,
    lastSentId: number,
  ): number {
    if (event.id <= lastSentId) return lastSentId;
    subscriber.next({
      id: String(event.id),
      type: 'order.status',
      data: { orderId: event.orderId, status: event.status },
    });
    return event.id;
  }
}
