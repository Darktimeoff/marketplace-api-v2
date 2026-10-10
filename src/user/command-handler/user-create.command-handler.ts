import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UserCreatedEvent } from '@marketplace/messaging-contracts';
import { UserRepository } from '../repository/user.repository.js';
import { User, type UserCreateEntityInterface } from '../entity/user.entity.js';
import { KafkaProducerService } from '../../generic/kafka/kafka-producer.service.js';

@Injectable()
export class UserCreateCommandHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly kafka: KafkaProducerService,
  ) {}

  async execute(input: UserCreateEntityInterface): Promise<void> {
    const user = await this.createUser(input);
    await this.kafka.publish(UserCreatedEvent.TOPIC, this.toUserCreatedEvent(user));
  }

  @Transactional()
  private async createUser(input: UserCreateEntityInterface): Promise<User> {
    await this.users.createIfAbsent(input);
    return this.users.findByIdentityIdOrFail(input.identityId);
  }

  private toUserCreatedEvent(user: User): UserCreatedEvent.MessageType {
    return {
      specversion: '1.0',
      id: user.publicId,
      source: UserCreatedEvent.SOURCE,
      type: UserCreatedEvent.TYPE,
      time: user.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: user.publicId,
      correlationid: user.publicId,
      data: {
        userId: user.id,
        userPublicId: user.publicId,
        identityId: user.identityId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}
