// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import * as z from 'zod';
import { OrderCreatedEvent } from '@marketplace/messaging-contracts';

export const orderCreatedEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.uuid(),
  type: z.literal(OrderCreatedEvent.TYPE),
  data: z.object({
    orderPublicId: z.uuid(),
    userId: z.int().positive(),
  }),
});
