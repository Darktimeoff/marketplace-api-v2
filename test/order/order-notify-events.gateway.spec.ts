import { describe, expect, it } from 'vitest';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderNotifyEventsGateway } from '../../src/order/gateway/order-notify-events.gateway.js';
import { OrderNotifyService } from '../../src/order/service/order-notify.service.js';
import { KafkaRejectedMessageException } from '../../src/generic/kafka/exception/kafka-rejected-message.exception.js';
import type { KafkaConsumerService } from '../../src/generic/kafka/kafka-consumer.service.js';
import type { KafkaSubscriptionInterface } from '../../src/generic/kafka/interface/kafka-subscription.interface.js';

function aGateway(): { notify: OrderNotifyService; subscription: KafkaSubscriptionInterface } {
  const notify = new OrderNotifyService();
  let subscription!: KafkaSubscriptionInterface;
  const consumer = { register: (registered: KafkaSubscriptionInterface) => { subscription = registered; } } as unknown as KafkaConsumerService;
  new OrderNotifyEventsGateway(consumer, notify).onModuleInit();
  return { notify, subscription };
}

describe('OrderNotifyEventsGateway', () => {
  it('registers a broadcast consumer of order.events', () => {
    expect(aGateway().subscription).toMatchObject({ groupId: 'order.notify', topic: 'order.events', broadcast: true });
  });

  it('maps created, paid and failed to statuses, using offset + 1 as the event id so offset 0 is not lost', async () => {
    const { notify, subscription } = aGateway();

    await subscription.handle({ type: 'order.created', data: { orderId: 7 } }, { partition: 0, offset: '0' });
    await subscription.handle({ type: 'order.paid', data: { orderId: 7 } }, { partition: 0, offset: '1' });
    await subscription.handle({ type: 'order.failed', data: { orderId: 8, status: 'failed_payment' } }, { partition: 1, offset: '0' });

    expect(notify.getAfter(7, 0)).toEqual([
      { id: 1, orderId: 7, status: OrderStatusEnum.pending_payment },
      { id: 2, orderId: 7, status: OrderStatusEnum.paid },
    ]);
    expect(notify.getAfter(8, 0)).toEqual([{ id: 1, orderId: 8, status: OrderStatusEnum.failed_payment }]);
  });

  it('skips types it does not stream and rejects a malformed known type', async () => {
    const { notify, subscription } = aGateway();

    await subscription.handle({ type: 'order.shipped', data: { orderId: 7 } }, { partition: 0, offset: '0' });
    await expect(subscription.handle({ type: 'order.paid', data: {} }, { partition: 0, offset: '1' })).rejects.toBeInstanceOf(KafkaRejectedMessageException);

    expect(notify.getAfter(7, 0)).toEqual([]);
  });
});
