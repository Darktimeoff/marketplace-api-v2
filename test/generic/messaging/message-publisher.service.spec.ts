import { describe, expect, it, vi } from 'vitest';
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { MessagePublisherService } from '../../../src/generic/messaging/message-publisher.service.js';
import { MessageBrokerEnum } from '../../../src/generic/messaging/enum/message-broker.enum.js';
import type { KafkaProducerService } from '../../../src/generic/kafka/kafka-producer.service.js';

const message = {
  specversion: '1.0',
  id: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
  source: '/media-service',
  type: 'media.variants.generate',
  time: '2026-11-01T10:00:00.000Z',
  datacontenttype: 'application/json',
  subject: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
  correlationid: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
  data: {},
} as const;

describe('MessagePublisherService', () => {
  function aPublisher() {
    const kafka = { publish: vi.fn().mockResolvedValue(undefined) };
    const amqp = { publish: vi.fn().mockResolvedValue(true) };
    return { kafka, amqp, publisher: new MessagePublisherService(kafka as unknown as KafkaProducerService, amqp as unknown as AmqpConnection) };
  }

  it('sends a kafka row to its topic', async () => {
    const { kafka, amqp, publisher } = aPublisher();

    await publisher.publish(MessageBrokerEnum.KAFKA, 'media.events', message);

    expect(kafka.publish).toHaveBeenCalledWith('media.events', message);
    expect(amqp.publish).not.toHaveBeenCalled();
  });

  it('sends a rabbitmq row to the queue named by its topic through the default exchange', async () => {
    const { kafka, amqp, publisher } = aPublisher();

    await publisher.publish(MessageBrokerEnum.RABBITMQ, 'media.variants', message);

    expect(amqp.publish).toHaveBeenCalledWith('', 'media.variants', message, { messageId: message.id, type: message.type });
    expect(kafka.publish).not.toHaveBeenCalled();
  });
});
