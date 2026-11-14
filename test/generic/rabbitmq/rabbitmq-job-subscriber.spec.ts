import { describe, expect, it, vi } from 'vitest';
import { MessageHandlerErrorBehavior, Nack, type AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqJobSubscriber } from '../../../src/generic/rabbitmq/rabbitmq-job-subscriber.js';
import { JobRejectedException } from '../../../src/generic/messaging/exception/job-rejected.exception.js';

type BrokerHandlerType = (message: unknown) => Promise<Nack | undefined>;

describe('RabbitMqJobSubscriber', () => {
  async function aSubscriber(handle: (message: unknown) => Promise<void>) {
    const channel = { assertExchange: vi.fn(), assertQueue: vi.fn(), bindQueue: vi.fn() };
    let brokerHandler!: BrokerHandlerType;
    const createSubscriber = vi.fn<(handler: BrokerHandlerType, options: object) => Promise<void>>(async (handler) => { brokerHandler = handler; });
    const amqp = {
      managedChannel: { addSetup: async (setup: (c: typeof channel) => Promise<void>) => setup(channel) },
      createSubscriber,
    } as unknown as AmqpConnection;
    const subscriber = new RabbitMqJobSubscriber(amqp);

    subscriber.register({ queue: 'media.variants', deliveryLimit: 5, handle });
    await subscriber.onApplicationBootstrap();

    return { channel, createSubscriber, brokerHandler };
  }

  it('declares the queue as quorum with its delivery limit, dead-lettered to <queue>.dlq through <queue>.dlx, before consuming', async () => {
    const { channel, createSubscriber } = await aSubscriber(() => Promise.resolve());

    expect(channel.assertExchange).toHaveBeenCalledWith('media.variants.dlx', 'direct', { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledWith('media.variants.dlq', 'media.variants.dlx', 'media.variants');
    expect(channel.assertQueue).toHaveBeenCalledWith('media.variants', {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': 'media.variants.dlx',
        'x-dead-letter-routing-key': 'media.variants',
        'x-delivery-limit': 5,
      },
    });
    expect(createSubscriber.mock.calls[0][1]).toMatchObject({
      queue: 'media.variants',
      createQueueIfNotExists: false,
      queueOptions: { channel: 'work' },
      errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
    });
  });

  it('acks after the handler, dead-letters a rejected job at once and lets any other error requeue', async () => {
    const outcomes = [Promise.resolve(), Promise.reject(new JobRejectedException('bad')), Promise.reject(new Error('storage down'))];
    const { brokerHandler } = await aSubscriber(() => outcomes.shift()!);

    await expect(brokerHandler({})).resolves.toBeUndefined();
    const rejected = await brokerHandler({});
    expect(rejected).toBeInstanceOf(Nack);
    expect((rejected as Nack).requeue).toBe(false);
    await expect(brokerHandler({})).rejects.toThrow('storage down');
  });
});
