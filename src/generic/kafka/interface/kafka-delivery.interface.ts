import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type { EventSubscriptionInterface } from '../../messaging/interface/event-subscriber.interface.js';

export interface KafkaDeliveryInterface {
  groupId: string;
  topic: string;
  partition: number;
  message: KafkaJS.KafkaMessage;
  handle: EventSubscriptionInterface['handle'];
  deadLetterTopic: string | null;
  traceparent: string | undefined;
  redelivered: boolean;
}
