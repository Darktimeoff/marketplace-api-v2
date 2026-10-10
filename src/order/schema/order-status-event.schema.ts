import * as z from 'zod';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderCreatedEvent, OrderFailedEvent, OrderPaidEvent } from '@marketplace/messaging-contracts';

const orderIdSchema = z.int().positive();

export const orderStatusEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(OrderCreatedEvent.TYPE), data: z.object({ orderId: orderIdSchema }) }),
  z.object({ type: z.literal(OrderPaidEvent.TYPE), data: z.object({ orderId: orderIdSchema }) }),
  z.object({
    type: z.literal(OrderFailedEvent.TYPE),
    data: z.object({ orderId: orderIdSchema, status: z.enum([OrderStatusEnum.canceled, OrderStatusEnum.failed_payment]) }),
  }),
]);
