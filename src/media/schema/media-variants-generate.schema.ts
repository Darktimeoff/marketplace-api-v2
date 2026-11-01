import * as z from 'zod';
import { MediaVariantsGenerateJob } from '@marketplace/messaging-contracts';

export const mediaVariantsGenerateSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(MediaVariantsGenerateJob.TYPE),
  data: z.object({
    mediaPublicId: z.uuid(),
  }),
}) satisfies z.ZodType<Pick<MediaVariantsGenerateJob.MessageType, 'specversion' | 'id' | 'type' | 'data'>>;
