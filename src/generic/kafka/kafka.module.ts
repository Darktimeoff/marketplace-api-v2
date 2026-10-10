import { Module } from '@nestjs/common';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { KafkaConsumerService } from './kafka-consumer.service.js';

@Module({
  providers: [KafkaClientService, KafkaProducerService, KafkaConsumerService],
  exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
