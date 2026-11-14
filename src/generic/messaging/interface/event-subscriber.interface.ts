import type { TopicEnum } from '@marketplace/messaging-contracts';

export interface EventPositionInterface {
  partition: number;
  offset: string;
}

export interface EventSubscriptionInterface {
  groupId: string;
  topic: TopicEnum;
  broadcast?: boolean;
  handle(event: unknown, position: EventPositionInterface): Promise<void>;
}

export interface EventSubscriberInterface {
  register(subscription: EventSubscriptionInterface): void;
}
