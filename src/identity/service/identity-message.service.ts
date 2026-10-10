import { Injectable } from '@nestjs/common';
import { IdentityRegisteredEvent } from '@marketplace/messaging-contracts';
import { Identity } from '../entity/identity.entity.js';
import type { IdentityOutboxCreateEntityInterface } from '../entity/identity-outbox.entity.js';
import { IdentityOutboxAggregateTypeEnum } from '../enum/identity-outbox-aggregate-type.enum.js';

@Injectable()
export class IdentityMessageService {
  toIdentityRegisteredOutbox(identity: Identity): IdentityOutboxCreateEntityInterface {
    return {
      id: identity.publicId,
      topic: IdentityRegisteredEvent.TOPIC,
      aggregateType: IdentityOutboxAggregateTypeEnum.IDENTITY,
      aggregateId: identity.publicId,
      type: IdentityRegisteredEvent.TYPE,
      payload: {
        identityId: identity.id,
        identityPublicId: identity.publicId,
        email: identity.email,
        phoneNumber: identity.loginPhone.fullNumber,
        role: identity.role,
        createdAt: identity.createdAt.toISOString(),
      } satisfies IdentityRegisteredEvent.DataInterface,
    };
  }
}
