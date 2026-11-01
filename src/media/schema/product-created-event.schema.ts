import * as z from 'zod';
import { ProductCreatedEvent } from '@marketplace/messaging-contracts';

export const productCreatedEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(ProductCreatedEvent.TYPE),
  data: z.object({
    productPublicId: z.uuid(),
    mediaIds: z.array(z.uuid()),
  }),
});
