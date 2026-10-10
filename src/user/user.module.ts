import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity.js';
import { Address } from './entity/address.entity.js';
import { UserOutbox } from './entity/user-outbox.entity.js';
import { UserOutboxRepository } from './repository/user-outbox.repository.js';
import { UserOutboxRelayService } from './service/user-outbox-relay.service.js';
import { UserMessageService } from './service/user-message.service.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { UserRepository } from './repository/user.repository.js';
import { UserCreateCommandHandler } from './command-handler/user-create.command-handler.js';
import { UserIdentityEventsGateway } from './gateway/user-identity-events.gateway.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Address, UserOutbox]), KafkaModule],
  providers: [UserRepository, UserOutboxRepository, UserCreateCommandHandler, UserIdentityEventsGateway, UserOutboxRelayService, UserMessageService],
})
export class UserModule {}
