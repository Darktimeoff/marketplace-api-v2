import type { TopicEnum } from '@marketplace/messaging-contracts';

export interface KafkaSubscriptionInterface {
  groupId: string;
  topic: TopicEnum;
  handle(event: unknown): Promise<void>;
}
