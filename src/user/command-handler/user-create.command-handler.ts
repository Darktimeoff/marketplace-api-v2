import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UserRepository } from '../repository/user.repository.js';
import type { UserCreateEntityInterface } from '../entity/user.entity.js';
import { UserOutboxRepository } from '../repository/user-outbox.repository.js';
import { UserMessage } from '../message/user.message.js';

@Injectable()
export class UserCreateCommandHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly outbox: UserOutboxRepository,
    private readonly messages: UserMessage,
  ) {}

  @Transactional()
  async execute(input: UserCreateEntityInterface): Promise<void> {
    if (!(await this.users.createIfAbsent(input))) {
      return;
    }

    const user = await this.users.findByPublicIdOrFail(input.publicId);
    await this.outbox.create(this.messages.toUserCreatedOutbox(user));
  }
}
