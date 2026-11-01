import { Injectable } from '@nestjs/common';
import { OrderStatusEvent } from '../interface/order-status-event.interface.js';

export const ORDER_EVENT_HISTORY_LIMIT = 100;

@Injectable()
export class OrderNotifyService {
  private readonly history = new Map<string, OrderStatusEvent[]>();
  private readonly listeners = new Map<string, Set<(event: OrderStatusEvent) => void>>();

  record(event: OrderStatusEvent): void {
    const history = this.history.get(event.orderPublicId) ?? [];

    if (history.length > 0 && history[history.length - 1].id >= event.id) {
      return;
    }

    history.push(event);
    if (history.length > ORDER_EVENT_HISTORY_LIMIT) {
      history.shift();
    }
    this.history.set(event.orderPublicId, history);
    for (const listener of this.listeners.get(event.orderPublicId) ?? []) {
      listener(event);
    }
  }

  getAfter(orderPublicId: string, lastEventId: number): OrderStatusEvent[] {
    return (this.history.get(orderPublicId) ?? []).filter((event) => event.id > lastEventId);
  }

  subscribe(
    orderPublicId: string,
    listener: (event: OrderStatusEvent) => void,
  ): () => void {
    const listeners = this.listeners.get(orderPublicId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(orderPublicId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(orderPublicId);
      }
    };
  }
}
