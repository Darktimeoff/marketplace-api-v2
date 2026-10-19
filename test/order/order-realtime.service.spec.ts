import { describe, expect, it, vi } from 'vitest';
import { OrderNotifyService, ORDER_EVENT_HISTORY_LIMIT } from '../../src/order/service/order-notify.service.js';
import { OrderStatusEnum } from '@marketplace/contracts-core';

describe('OrderNotifyService', () => {
  it('replays only events after the requested id', () => {
    const service = new OrderNotifyService();
    const created = { id: 4, orderId: 11, status: OrderStatusEnum.pending_payment };
    const paid = { id: 9, orderId: 11, status: OrderStatusEnum.paid };
    service.record(created);
    service.record(paid);
    service.record({ id: 5, orderId: 12, status: OrderStatusEnum.pending_payment });

    expect(service.getAfter(11, 4)).toEqual([paid]);
    expect(service.getAfter(11, 0)).toEqual([created, paid]);
  });

  it('ignores an event that is not newer than the last one for its order', () => {
    const service = new OrderNotifyService();
    const listener = vi.fn();
    service.subscribe(11, listener);

    service.record({ id: 7, orderId: 11, status: OrderStatusEnum.paid });
    service.record({ id: 7, orderId: 11, status: OrderStatusEnum.paid });
    service.record({ id: 3, orderId: 11, status: OrderStatusEnum.pending_payment });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.getAfter(11, 0)).toHaveLength(1);
  });

  it('notifies only listeners for the matching order and stops after unsubscribe', () => {
    const service = new OrderNotifyService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(11, listener);

    service.record({ id: 1, orderId: 12, status: OrderStatusEnum.paid });
    service.record({ id: 2, orderId: 11, status: OrderStatusEnum.paid });
    unsubscribe();
    unsubscribe();
    service.record({ id: 3, orderId: 11, status: OrderStatusEnum.canceled });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('retains only the configured number of recent events per order', () => {
    const service = new OrderNotifyService();
    for (let id = 1; id <= ORDER_EVENT_HISTORY_LIMIT + 1; id++) {
      service.record({ id, orderId: 11, status: OrderStatusEnum.paid });
    }

    const events = service.getAfter(11, 0);
    expect(events).toHaveLength(ORDER_EVENT_HISTORY_LIMIT);
    expect(events[0].id).toBe(2);
  });
});
