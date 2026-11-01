import * as z from 'zod';
import { IdentityRegisteredEvent } from '@marketplace/messaging-contracts';

export const identityRegisteredEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(IdentityRegisteredEvent.TYPE),
  data: z
    .object({
      publicId: z.uuid().optional(),
      identityPublicId: z.uuid().optional(),
      email: z.email().nullable(),
      phoneNumber: z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable(),
    })
    .transform(({ publicId, identityPublicId, ...data }, context) => {
      const personPublicId = publicId ?? identityPublicId;

      if (!personPublicId) {
        context.addIssue({ code: 'custom', message: 'publicId is required' });
        return z.NEVER;
      }

      return { ...data, publicId: personPublicId };
    }),
});
