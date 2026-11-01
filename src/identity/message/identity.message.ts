import { Injectable } from '@nestjs/common';
import { IdentityRegisteredEvent } from '@marketplace/messaging-contracts';
import { Identity } from '../entity/identity.entity.js';
import type { IdentityOutboxCreateEntityInterface } from '../entity/identity-outbox.entity.js';
import { IdentityOutboxAggregateTypeEnum } from '../enum/identity-outbox-aggregate-type.enum.js';
import { MessageBrokerEnum } from '../../generic/messaging/enum/message-broker.enum.js';

@Injectable()
export class IdentityMessage {
  toIdentityRegisteredOutbox(identity: Identity): IdentityOutboxCreateEntityInterface {
    return {
      id: identity.publicId,
      broker: MessageBrokerEnum.KAFKA,
      topic: IdentityRegisteredEvent.TOPIC,
      aggregateType: IdentityOutboxAggregateTypeEnum.IDENTITY,
      aggregateId: identity.publicId,
      type: IdentityRegisteredEvent.TYPE,
      payload: {
        publicId: identity.publicId,
        email: identity.email,
        phoneNumber: identity.loginPhone.fullNumber,
        role: identity.role,
        createdAt: identity.createdAt.toISOString(),
      } satisfies IdentityRegisteredEvent.DataInterface,
    };
  }
}
