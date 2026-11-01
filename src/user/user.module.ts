import { QueueModule } from '../generic/queue/queue.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity.js';
import { Address } from './entity/address.entity.js';
import { UserOutbox } from './entity/user-outbox.entity.js';
import { UserOutboxRepository } from './repository/user-outbox.repository.js';
import { UserOutboxRelay } from './relay/user-outbox.relay.js';
import { UserMessage } from './message/user.message.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { UserRepository } from './repository/user.repository.js';
import { UserCreateCommandHandler } from './command-handler/user-create.command-handler.js';
import { UserIdentityEventsGateway } from './gateway/user-identity-events.gateway.js';

@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([User, Address, UserOutbox]), KafkaModule],
  providers: [UserRepository, UserOutboxRepository, UserCreateCommandHandler, UserIdentityEventsGateway, UserOutboxRelay, UserMessage],
})
export class UserModule {}
