import { Inject, Injectable } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import type { CloudEventInterface, TopicEnum } from '@marketplace/messaging-contracts';
import { EVENT_PUBLISHER, JOB_PUBLISHER } from './constant/messaging.constant.js';
import type { EventPublisherInterface } from './interface/event-publisher.interface.js';
import type { JobPublisherInterface } from './interface/job-publisher.interface.js';
import { MessageBrokerEnum } from './enum/message-broker.enum.js';
import { Traced } from '../telemetry/decorator/traced.decorator.js';
import { currentTraceparent } from '../telemetry/util/current-traceparent.util.js';

@Injectable()
export class MessagePublisherService {
  constructor(
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    @Inject(JOB_PUBLISHER) private readonly jobs: JobPublisherInterface,
  ) {}

  @Traced({
    name: (_, topic) => `publish ${topic}`,
    kind: SpanKind.PRODUCER,
    parent: (_, __, message) => message.traceparent,
    attributes: (broker, topic, message) => ({ 'messaging.system': broker, 'messaging.destination.name': topic, 'messaging.message.id': message.id }),
  })
  async publish(broker: MessageBrokerEnum, topic: string, message: CloudEventInterface<string, unknown>): Promise<void> {
    const traceparent = currentTraceparent();
    const sent = traceparent ? { ...message, traceparent } : message;

    if (broker === MessageBrokerEnum.RABBITMQ) {
      await this.jobs.publish(topic, sent);
      return;
    }

    await this.events.publish(topic as TopicEnum, sent);
  }
}
