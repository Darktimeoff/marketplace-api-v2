import * as z from 'zod';
import { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { MediaVariantsGeneratedEvent } from '@marketplace/messaging-contracts';

export const mediaVariantsGeneratedEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(MediaVariantsGeneratedEvent.TYPE),
  data: z.object({
    mediaPublicId: z.uuid(),
    thumbHash: z.string().min(1).max(64),
    variants: z.array(
      z.object({
        name: z.enum(MediaVariantNameEnum),
        mimeType: z.string().min(1).max(127),
        storageKey: z.string().min(1).max(512),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    ),
  }),
}) satisfies z.ZodType<
  Pick<MediaVariantsGeneratedEvent.MessageType, 'specversion' | 'id' | 'type'> & {
    data: Pick<MediaVariantsGeneratedEvent.DataInterface, 'mediaPublicId' | 'thumbHash' | 'variants'>;
  }
>;
