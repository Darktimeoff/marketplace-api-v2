import type { CloudEventInterface } from '@marketplace/messaging-contracts';

export interface JobPublisherInterface {
  publish(queue: string, message: CloudEventInterface<string, unknown>): Promise<void>;
}
