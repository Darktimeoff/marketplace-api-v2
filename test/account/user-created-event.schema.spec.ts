import { describe, expect, it } from 'vitest';
import { userCreatedEventSchema } from '../../src/account/schema/user-created-event.schema.js';

const person = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';

function anEvent(data: object): object {
  return { specversion: '1.0', id: person, type: 'user.created', data };
}

describe('account userCreatedEventSchema', () => {
  it('reads the person publicId from the current event', () => {
    expect(userCreatedEventSchema.parse(anEvent({ publicId: person, email: 'jane@example.com' })).data).toEqual({ publicId: person });
  });

  it('reads the identity publicId of an event published before the rename as the person publicId', () => {
    const old = anEvent({ userId: 12, userPublicId: '345db97f-3775-4a03-ac88-3499486dfbaf', identityId: 10, identityPublicId: person });

    expect(userCreatedEventSchema.parse(old).data).toEqual({ publicId: person });
  });

  it('leaves the publicId empty for events that predate it, so the gateway can skip them', () => {
    expect(userCreatedEventSchema.parse(anEvent({ userId: 12, userPublicId: '345db97f-3775-4a03-ac88-3499486dfbaf' })).data).toEqual({ publicId: null });
  });
});
