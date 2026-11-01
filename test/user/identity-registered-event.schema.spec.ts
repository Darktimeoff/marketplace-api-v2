import { describe, expect, it } from 'vitest';
import { identityRegisteredEventSchema } from '../../src/user/schema/identity-registered-event.schema.js';

const person = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';

function anEvent(data: object): object {
  return { specversion: '1.0', id: person, type: 'identity.registered', data };
}

describe('identityRegisteredEventSchema', () => {
  it('reads the person publicId from the current event', () => {
    const parsed = identityRegisteredEventSchema.parse(anEvent({ publicId: person, email: 'jane@example.com', phoneNumber: null }));

    expect(parsed.data).toEqual({ publicId: person, email: 'jane@example.com', phoneNumber: null });
  });

  it('reads an event published before the rename the same way, so a replay creates the same user', () => {
    const parsed = identityRegisteredEventSchema.parse(anEvent({ identityId: 9, identityPublicId: person, email: 'jane@example.com', phoneNumber: null }));

    expect(parsed.data).toEqual({ publicId: person, email: 'jane@example.com', phoneNumber: null });
  });

  it('rejects an event without any person publicId', () => {
    expect(identityRegisteredEventSchema.safeParse(anEvent({ email: null, phoneNumber: null })).success).toBe(false);
  });
});
