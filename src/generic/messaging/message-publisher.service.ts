import { Inject, Injectable } from '@nestjs/common';
import type { CloudEventInterface, TopicEnum } from '@marketplace/messaging-contracts';
import { EVENT_PUBLISHER, JOB_PUBLISHER } from './constant/messaging.constant.js';
import type { EventPublisherInterface } from './interface/event-publisher.interface.js';
import type { JobPublisherInterface } from './interface/job-publisher.interface.js';
import { MessageBrokerEnum } from './enum/message-broker.enum.js';

@Injectable()
export class MessagePublisherService {
  constructor(
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    @Inject(JOB_PUBLISHER) private readonly jobs: JobPublisherInterface,
  ) {}

  async publish(broker: MessageBrokerEnum, topic: string, message: CloudEventInterface<string, unknown>): Promise<void> {
    if (broker === MessageBrokerEnum.RABBITMQ) {
      await this.jobs.publish(topic, message);
      return;
    }

    await this.events.publish(topic as TopicEnum, message);
  }
}
