import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UserCreatedEvent } from '@marketplace/messaging-contracts';
import { UserRepository } from '../repository/user.repository.js';
import { User, type UserCreateEntityInterface } from '../entity/user.entity.js';
import { UserOutboxRepository } from '../repository/user-outbox.repository.js';
import type { UserOutboxCreateEntityInterface } from '../entity/user-outbox.entity.js';
import { UserOutboxAggregateTypeEnum } from '../enum/user-outbox-aggregate-type.enum.js';

@Injectable()
export class UserCreateCommandHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly outbox: UserOutboxRepository,
  ) {}

  @Transactional()
  async execute(input: UserCreateEntityInterface): Promise<void> {
    if (!(await this.users.createIfAbsent(input))) {
      return;
    }

    const user = await this.users.findByIdentityIdOrFail(input.identityId);
    await this.outbox.create(this.toUserCreatedOutbox(user));
  }

  private toUserCreatedOutbox(user: User): UserOutboxCreateEntityInterface {
    return {
      id: user.publicId,
      topic: UserCreatedEvent.TOPIC,
      aggregateType: UserOutboxAggregateTypeEnum.USER,
      aggregateId: user.publicId,
      type: UserCreatedEvent.TYPE,
      payload: this.toUserCreatedData(user),
    };
  }

  private toUserCreatedData(user: User): UserCreatedEvent.DataInterface {
    return {
      userId: user.id,
      userPublicId: user.publicId,
      identityId: user.identityId,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
