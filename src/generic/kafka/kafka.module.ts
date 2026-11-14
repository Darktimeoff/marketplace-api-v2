import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { EVENT_PUBLISHER, EVENT_SUBSCRIBER } from '../messaging/constant/messaging.constant.js';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaEventPublisher } from './kafka-event-publisher.js';
import { KafkaEventSubscriber } from './kafka-event-subscriber.js';

@Module({
  imports: [SecretManagerModule],
  providers: [
    KafkaClientService,
    KafkaEventPublisher,
    KafkaEventSubscriber,
    { provide: EVENT_PUBLISHER, useExisting: KafkaEventPublisher },
    { provide: EVENT_SUBSCRIBER, useExisting: KafkaEventSubscriber },
  ],
  exports: [EVENT_PUBLISHER, EVENT_SUBSCRIBER],
})
export class KafkaModule {}
