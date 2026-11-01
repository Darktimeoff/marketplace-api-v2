import * as z from 'zod';
import { UserCreatedEvent } from '@marketplace/messaging-contracts';

export const userCreatedEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(UserCreatedEvent.TYPE),
  data: z
    .object({
      userId: z.int().positive(),
      publicId: z.uuid().optional(),
      identityPublicId: z.uuid().optional(),
    })
    .transform(({ userId, publicId, identityPublicId }) => ({ userId, publicId: publicId ?? identityPublicId ?? null })),
});
