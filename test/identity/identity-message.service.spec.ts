import { describe, expect, it } from 'vitest';
import { IdentityMessageService } from '../../src/identity/service/identity-message.service.js';
import type { Identity } from '../../src/identity/entity/identity.entity.js';

describe('IdentityMessageService', () => {
  it('builds identity.registered as an outbox row whose id and key are the identity publicId', () => {
    const identity = {
      id: 9,
      publicId: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
      email: 'jane@example.com',
      loginPhone: { fullNumber: '+380501234567' },
      role: 'user',
      createdAt: new Date('2026-10-10T10:00:00.000Z'),
    } as unknown as Identity;

    expect(new IdentityMessageService().toIdentityRegisteredOutbox(identity)).toEqual({
      id: identity.publicId,
      topic: 'identity.events',
      aggregateType: 'Identity',
      aggregateId: identity.publicId,
      type: 'identity.registered',
      payload: {
        identityId: 9,
        identityPublicId: identity.publicId,
        email: 'jane@example.com',
        phoneNumber: '+380501234567',
        role: 'user',
        createdAt: '2026-10-10T10:00:00.000Z',
      },
    });
  });
});
