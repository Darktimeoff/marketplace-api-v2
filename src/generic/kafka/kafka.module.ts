import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { KafkaClientService } from './kafka-client.service.js';
import { KafkaProducerService } from './kafka-producer.service.js';
import { KafkaConsumerService } from './kafka-consumer.service.js';

@Module({
  imports: [SecretManagerModule],
  providers: [KafkaClientService, KafkaProducerService, KafkaConsumerService],
  exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
