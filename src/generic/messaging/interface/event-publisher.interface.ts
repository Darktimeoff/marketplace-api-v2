import type { CloudEventInterface, TopicEnum } from '@marketplace/messaging-contracts';

export interface EventPublisherInterface {
  publish(topic: TopicEnum, event: CloudEventInterface<string, unknown>): Promise<void>;
}
