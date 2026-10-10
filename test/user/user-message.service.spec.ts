import { describe, expect, it } from 'vitest';
import { LanguageEnum } from '@marketplace/contracts-core';
import { UserMessageService } from '../../src/user/service/user-message.service.js';
import type { User } from '../../src/user/entity/user.entity.js';

describe('UserMessageService', () => {
  it('builds user.created as an outbox row whose id and key are the user publicId', () => {
    const user = {
      id: 12,
      publicId: '345db97f-3775-4a03-ac88-3499486dfbaf',
      identityId: 10,
      email: 'jane@example.com',
      phoneNumber: null,
      firstName: null,
      lastName: null,
      language: LanguageEnum.en,
      createdAt: new Date('2026-10-10T10:00:01.000Z'),
    } as unknown as User;

    expect(new UserMessageService().toUserCreatedOutbox(user)).toEqual({
      id: user.publicId,
      topic: 'user.events',
      aggregateType: 'User',
      aggregateId: user.publicId,
      type: 'user.created',
      payload: {
        userId: 12,
        userPublicId: user.publicId,
        identityId: 10,
        email: 'jane@example.com',
        phoneNumber: null,
        firstName: null,
        lastName: null,
        language: LanguageEnum.en,
        createdAt: '2026-10-10T10:00:01.000Z',
      },
    });
  });
});
