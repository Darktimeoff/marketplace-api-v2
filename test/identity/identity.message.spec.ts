import { describe, expect, it } from 'vitest';
import { IdentityMessage } from '../../src/identity/message/identity.message.js';
import type { Identity } from '../../src/identity/entity/identity.entity.js';

describe('IdentityMessage', () => {
  it('builds identity.registered as an outbox row whose id and key are the identity publicId', () => {
    const identity = {
      id: 9,
      publicId: '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d',
      email: 'jane@example.com',
      loginPhone: { fullNumber: '+380501234567' },
      role: 'user',
      createdAt: new Date('2026-10-10T10:00:00.000Z'),
    } as unknown as Identity;

    expect(new IdentityMessage().toIdentityRegisteredOutbox(identity)).toEqual({
      id: identity.publicId,
      broker: 'kafka',
      topic: 'identity.events',
      aggregateType: 'Identity',
      aggregateId: identity.publicId,
      type: 'identity.registered',
      payload: {
        publicId: identity.publicId,
        email: 'jane@example.com',
        phoneNumber: '+380501234567',
        role: 'user',
        createdAt: '2026-10-10T10:00:00.000Z',
      },
    });
  });
});
