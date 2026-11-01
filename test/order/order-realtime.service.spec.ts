import { describe, expect, it, vi } from 'vitest';
import { OrderNotifyService, ORDER_EVENT_HISTORY_LIMIT } from '../../src/order/service/order-notify.service.js';
import { OrderStatusEnum } from '@marketplace/contracts-core';

const ORDER = 'aaaaaaaa-0000-4000-8000-000000000011';
const OTHER_ORDER = 'aaaaaaaa-0000-4000-8000-000000000012';

describe('OrderNotifyService', () => {
  it('replays only events after the requested id', () => {
    const service = new OrderNotifyService();
    const created = { id: 4, orderPublicId: ORDER, status: OrderStatusEnum.pending_payment };
    const paid = { id: 9, orderPublicId: ORDER, status: OrderStatusEnum.paid };
    service.record(created);
    service.record(paid);
    service.record({ id: 5, orderPublicId: OTHER_ORDER, status: OrderStatusEnum.pending_payment });

    expect(service.getAfter(ORDER, 4)).toEqual([paid]);
    expect(service.getAfter(ORDER, 0)).toEqual([created, paid]);
  });

  it('ignores an event that is not newer than the last one for its order', () => {
    const service = new OrderNotifyService();
    const listener = vi.fn();
    service.subscribe(ORDER, listener);

    service.record({ id: 7, orderPublicId: ORDER, status: OrderStatusEnum.paid });
    service.record({ id: 7, orderPublicId: ORDER, status: OrderStatusEnum.paid });
    service.record({ id: 3, orderPublicId: ORDER, status: OrderStatusEnum.pending_payment });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.getAfter(ORDER, 0)).toHaveLength(1);
  });

  it('notifies only listeners for the matching order and stops after unsubscribe', () => {
    const service = new OrderNotifyService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(ORDER, listener);

    service.record({ id: 1, orderPublicId: OTHER_ORDER, status: OrderStatusEnum.paid });
    service.record({ id: 2, orderPublicId: ORDER, status: OrderStatusEnum.paid });
    unsubscribe();
    unsubscribe();
    service.record({ id: 3, orderPublicId: ORDER, status: OrderStatusEnum.canceled });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('retains only the configured number of recent events per order', () => {
    const service = new OrderNotifyService();
    for (let id = 1; id <= ORDER_EVENT_HISTORY_LIMIT + 1; id++) {
      service.record({ id, orderPublicId: ORDER, status: OrderStatusEnum.paid });
    }

    const events = service.getAfter(ORDER, 0);
    expect(events).toHaveLength(ORDER_EVENT_HISTORY_LIMIT);
    expect(events[0].id).toBe(2);
  });
});
