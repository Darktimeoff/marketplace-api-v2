import type { TopicEnum } from '@marketplace/messaging-contracts';

export interface KafkaMessagePositionInterface {
  partition: number;
  offset: string;
}

export interface KafkaSubscriptionInterface {
  groupId: string;
  topic: TopicEnum;
  broadcast?: boolean;
  handle(event: unknown, position: KafkaMessagePositionInterface): Promise<void>;
}
