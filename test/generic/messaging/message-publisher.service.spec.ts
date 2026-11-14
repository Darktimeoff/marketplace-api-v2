import { describe, expect, it, vi } from 'vitest';
import { MessagePublisherService } from '../../../src/generic/messaging/message-publisher.service.js';
import { MessageBrokerEnum } from '../../../src/generic/messaging/enum/message-broker.enum.js';
import type { EventPublisherInterface } from '../../../src/generic/messaging/interface/event-publisher.interface.js';
import type { JobPublisherInterface } from '../../../src/generic/messaging/interface/job-publisher.interface.js';

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
    const jobs = { publish: vi.fn().mockResolvedValue(undefined) };
    return { kafka, jobs, publisher: new MessagePublisherService(kafka as unknown as EventPublisherInterface, jobs as unknown as JobPublisherInterface) };
  }

  it('sends a kafka row to its topic', async () => {
    const { kafka, jobs, publisher } = aPublisher();

    await publisher.publish(MessageBrokerEnum.KAFKA, 'media.events', message);

    expect(kafka.publish).toHaveBeenCalledWith('media.events', message);
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('sends a rabbitmq row to the job queue named by its topic', async () => {
    const { kafka, jobs, publisher } = aPublisher();

    await publisher.publish(MessageBrokerEnum.RABBITMQ, 'media.variants', message);

    expect(jobs.publish).toHaveBeenCalledWith('media.variants', message);
    expect(kafka.publish).not.toHaveBeenCalled();
  });
});
