import { Injectable } from '@nestjs/common';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderStatusEvent } from '../interface/order-status-event.interface.js';

export const ORDER_EVENT_HISTORY_LIMIT = 100;

@Injectable()
export class OrderNotifyService {
  private nextEventId = 1;
  private readonly history = new Map<number, OrderStatusEvent[]>();
  private readonly listeners = new Map<number, Set<(event: OrderStatusEvent) => void>>();

  notifyStatusChanged(orderId: number, status: OrderStatusEnum): OrderStatusEvent {
    const event = { id: this.nextEventId++, orderId, status };
    const history = this.history.get(orderId) ?? [];
    history.push(event);
    if (history.length > ORDER_EVENT_HISTORY_LIMIT) {
      history.shift();
    }
    this.history.set(orderId, history);
    for (const listener of this.listeners.get(orderId) ?? []) {
      listener(event);
    }
    return event;
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
