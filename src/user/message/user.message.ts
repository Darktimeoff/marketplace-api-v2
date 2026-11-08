import { Injectable } from '@nestjs/common';
import { UserCreatedEvent } from '@marketplace/messaging-contracts';
import { User } from '../entity/user.entity.js';
import type { UserOutboxCreateEntityInterface } from '../entity/user-outbox.entity.js';
import { UserOutboxAggregateTypeEnum } from '../enum/user-outbox-aggregate-type.enum.js';
import { MessageBrokerEnum } from '../../generic/messaging/enum/message-broker.enum.js';

@Injectable()
export class UserMessage {
  toUserCreatedOutbox(user: User): UserOutboxCreateEntityInterface {
    return {
      id: user.publicId,
      broker: MessageBrokerEnum.KAFKA,
      topic: UserCreatedEvent.TOPIC,
      aggregateType: UserOutboxAggregateTypeEnum.USER,
      aggregateId: user.publicId,
      type: UserCreatedEvent.TYPE,
      payload: {
        publicId: user.publicId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        createdAt: user.createdAt.toISOString(),
      } satisfies UserCreatedEvent.DataInterface,
    };
  }
}
