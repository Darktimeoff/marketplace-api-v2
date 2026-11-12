import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module.js';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module.js';
import { MessagePublisherService } from './message-publisher.service.js';

@Module({
  imports: [KafkaModule, RabbitMqModule],
  providers: [MessagePublisherService],
  exports: [MessagePublisherService, KafkaModule, RabbitMqModule],
})
export class MessagingModule {}
