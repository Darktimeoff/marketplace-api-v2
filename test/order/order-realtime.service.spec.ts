import { describe, expect, it, vi } from 'vitest';
import { OrderNotifyService, ORDER_EVENT_HISTORY_LIMIT } from '../../src/order/service/order-notify.service.js';
import { OrderStatusEnum } from '../../src/generic/enum/enums.js';

describe('OrderNotifyService', () => {
  it('assigns increasing IDs and replays only events after the requested ID', () => {
    const service = new OrderNotifyService();
    const first = service.notifyStatusChanged(11, OrderStatusEnum.paid);
    const second = service.notifyStatusChanged(11, OrderStatusEnum.shipped);
    service.notifyStatusChanged(12, OrderStatusEnum.paid);

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(service.getAfter(11, 1)).toEqual([second]);
    expect(service.getAfter(11, 0)).toEqual([first, second]);
  });

  it('notifies only listeners for the matching order and stops after unsubscribe', () => {
    const service = new OrderNotifyService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(11, listener);

    service.notifyStatusChanged(12, OrderStatusEnum.paid);
    service.notifyStatusChanged(11, OrderStatusEnum.paid);
    unsubscribe();
    unsubscribe();
    service.notifyStatusChanged(11, OrderStatusEnum.shipped);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('retains only the configured number of recent events per order', () => {
    const service = new OrderNotifyService();
    const published = Array.from({ length: ORDER_EVENT_HISTORY_LIMIT + 1 }, () =>
      service.notifyStatusChanged(11, OrderStatusEnum.paid),
    );

    expect(service.getAfter(11, 0)).toHaveLength(ORDER_EVENT_HISTORY_LIMIT);
    expect(service.getAfter(11, published[1].id)).toHaveLength(ORDER_EVENT_HISTORY_LIMIT - 1);
  });
});
