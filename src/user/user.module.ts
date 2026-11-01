import { QueueModule } from '../generic/queue/queue.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity.js';
import { Address } from './entity/address.entity.js';
import { UserOutbox } from './entity/user-outbox.entity.js';
import { UserOutboxRepository } from './repository/user-outbox.repository.js';
import { UserOutboxRelay } from './relay/user-outbox.relay.js';
import { UserOutboxCleanupCron } from './cron/user-outbox-cleanup.cron.js';
import { UserMessage } from './message/user.message.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { UserRepository } from './repository/user.repository.js';
import { UserCreateCommandHandler } from './command-handler/user-create.command-handler.js';
import { UserIdentityEventsConsumer } from './consumer/user-identity-events.consumer.js';
import { MessagingModule } from '../generic/messaging/messaging.module.js';

@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([User, Address, UserOutbox]), KafkaModule, MessagingModule],
  providers: [UserRepository, UserOutboxRepository, UserCreateCommandHandler, UserIdentityEventsConsumer, UserOutboxRelay, UserOutboxCleanupCron, UserMessage],
})
export class UserModule {}
