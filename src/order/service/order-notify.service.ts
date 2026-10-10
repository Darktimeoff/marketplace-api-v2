import { Injectable } from '@nestjs/common';
import { OrderStatusEvent } from '../interface/order-status-event.interface.js';

export const ORDER_EVENT_HISTORY_LIMIT = 100;

@Injectable()
export class OrderNotifyService {
  private readonly history = new Map<number, OrderStatusEvent[]>();
  private readonly listeners = new Map<number, Set<(event: OrderStatusEvent) => void>>();

  record(event: OrderStatusEvent): void {
    const history = this.history.get(event.orderId) ?? [];

    if (history.length > 0 && history[history.length - 1].id >= event.id) {
      return;
    }

    history.push(event);
    if (history.length > ORDER_EVENT_HISTORY_LIMIT) {
      history.shift();
    }
    this.history.set(event.orderId, history);
    for (const listener of this.listeners.get(event.orderId) ?? []) {
      listener(event);
    }
  }

  getAfter(orderId: number, lastEventId: number): OrderStatusEvent[] {
    return (this.history.get(orderId) ?? []).filter((event) => event.id > lastEventId);
  }

  subscribe(
    orderId: number,
    listener: (event: OrderStatusEvent) => void,
  ): () => void {
    const listeners = this.listeners.get(orderId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(orderId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(orderId);
      }
    };
  }
}
