import { describe, expect, it } from 'vitest';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderNotifyEventsConsumer } from '../../src/order/consumer/order-notify-events.consumer.js';
import { OrderNotifyService } from '../../src/order/service/order-notify.service.js';
import { KafkaRejectedMessageException } from '../../src/generic/kafka/exception/kafka-rejected-message.exception.js';
import type { KafkaConsumerService } from '../../src/generic/kafka/kafka-consumer.service.js';
import type { KafkaSubscriptionInterface } from '../../src/generic/kafka/interface/kafka-subscription.interface.js';

function aGateway(): { notify: OrderNotifyService; subscription: KafkaSubscriptionInterface } {
  const notify = new OrderNotifyService();
  let subscription!: KafkaSubscriptionInterface;
  const consumer = { register: (registered: KafkaSubscriptionInterface) => { subscription = registered; } } as unknown as KafkaConsumerService;
  new OrderNotifyEventsConsumer(consumer, notify).onModuleInit();
  return { notify, subscription };
}

const ORDER = 'aaaaaaaa-0000-4000-8000-000000000011';
const OTHER_ORDER = 'aaaaaaaa-0000-4000-8000-000000000012';

describe('OrderNotifyEventsConsumer', () => {
  it('registers a broadcast consumer of order.events', () => {
    expect(aGateway().subscription).toMatchObject({ groupId: 'order.notify', topic: 'order.events', broadcast: true });
  });

  it('maps created, paid and failed to statuses, using offset + 1 as the event id so offset 0 is not lost', async () => {
    const { notify, subscription } = aGateway();

    await subscription.handle({ type: 'order.created', data: { orderPublicId: ORDER } }, { partition: 0, offset: '0' });
    await subscription.handle({ type: 'order.paid', data: { orderPublicId: ORDER } }, { partition: 0, offset: '1' });
    await subscription.handle({ type: 'order.failed', data: { orderPublicId: OTHER_ORDER, status: 'failed_payment' } }, { partition: 1, offset: '0' });

    expect(notify.getAfter(ORDER, 0)).toEqual([
      { id: 1, orderPublicId: ORDER, status: OrderStatusEnum.pending_payment },
      { id: 2, orderPublicId: ORDER, status: OrderStatusEnum.paid },
    ]);
    expect(notify.getAfter(OTHER_ORDER, 0)).toEqual([{ id: 1, orderPublicId: OTHER_ORDER, status: OrderStatusEnum.failed_payment }]);
  });

  it('skips types it does not stream and rejects a malformed known type', async () => {
    const { notify, subscription } = aGateway();

    await subscription.handle({ type: 'order.shipped', data: { orderPublicId: ORDER } }, { partition: 0, offset: '0' });
    await expect(subscription.handle({ type: 'order.paid', data: {} }, { partition: 0, offset: '1' })).rejects.toBeInstanceOf(KafkaRejectedMessageException);

    expect(notify.getAfter(ORDER, 0)).toEqual([]);
  });

  it('reads events published before the int id was dropped by their orderPublicId', async () => {
    const { notify, subscription } = aGateway();

    await subscription.handle({ type: 'order.paid', data: { orderId: 7, orderPublicId: ORDER } }, { partition: 0, offset: '4' });

    expect(notify.getAfter(ORDER, 0)).toEqual([{ id: 5, orderPublicId: ORDER, status: OrderStatusEnum.paid }]);
  });
});
