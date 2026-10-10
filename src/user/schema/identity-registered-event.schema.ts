import * as z from 'zod';
import { IdentityRegisteredEvent } from '@marketplace/messaging-contracts';

export const identityRegisteredEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(IdentityRegisteredEvent.TYPE),
  data: z.object({
    identityId: z.int().positive(),
    identityPublicId: z.uuid(),
    email: z.email().nullable(),
    phoneNumber: z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable(),
  }),
});
