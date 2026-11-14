import { describe, expect, it, vi } from 'vitest';
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqJobPublisher } from '../../../src/generic/rabbitmq/rabbitmq-job-publisher.js';

describe('RabbitMqJobPublisher', () => {
  it('sends a job to its queue through the default exchange with the message id and type', async () => {
    const amqp = { publish: vi.fn().mockResolvedValue(true) };
    const message = { specversion: '1.0', id: 'job-1', source: '/media-service', type: 'media.variants.generate', time: '2026-11-01T10:00:00.000Z', datacontenttype: 'application/json', subject: 'job-1', correlationid: 'job-1', data: {} } as const;

    await new RabbitMqJobPublisher(amqp as unknown as AmqpConnection).publish('media.variants', message);

    expect(amqp.publish).toHaveBeenCalledWith('', 'media.variants', message, { messageId: 'job-1', type: 'media.variants.generate' });
  });
});
