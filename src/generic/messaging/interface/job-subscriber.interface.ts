export interface JobSubscriptionInterface {
  queue: string;
  deliveryLimit: number;
  handle(message: unknown): Promise<void>;
}

export interface JobSubscriberInterface {
  register(subscription: JobSubscriptionInterface): void;
}
