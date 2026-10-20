import { Controller, Headers, MessageEvent, Param, ParseIntPipe, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OrderAccessGuard } from '../guard/order-access.guard.js';
import { OrderStatusEvent } from '../interface/order-status-event.interface.js';
import { OrderNotifyService } from '../service/order-notify.service.js';
import { Public } from '../../generic/auth/decorator/public.decorator.js';

@Public()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orderNotify: OrderNotifyService) {}

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
