import { ActivityFailure, ApplicationFailure, CancellationScope, proxyActivities } from '@temporalio/workflow';
import { OrderStatusEnum } from '@marketplace/contracts-core';
import { OrderPlaceFailureTypeEnum } from '../enum/order-place-failure-type.enum.js';
import type { OrderFailureInterface } from '../interface/order-failure.interface.js';
import type {
  OrderPlaceActivitiesInterface,
  OrderPlaceChargeInterface,
  OrderPlaceWorkflowInputInterface,
} from './order-place-workflow.interface.js';

const { reserveStock, chargeCustomer } = proxyActivities<OrderPlaceActivitiesInterface>({
  startToCloseTimeout: '10 seconds',
  scheduleToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '10 seconds',
  },
});

const { releaseStock, refundCustomer, markPaid, markFailed } = proxyActivities<OrderPlaceActivitiesInterface>({
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
  },
});

export async function orderPlaceWorkflow(input: OrderPlaceWorkflowInputInterface): Promise<OrderStatusEnum> {
  const charge: OrderPlaceChargeInterface = {
    orderPublicId: input.orderPublicId,
    userId: input.userId,
    totalAmount: input.totalAmount,
  };
  let isChargeSent = false;

  try {
    await reserveStock(input.orderPublicId, input.items);
    isChargeSent = true;
    await chargeCustomer(charge);
  } catch (error) {
    const failureType = toFailureType(error);
    const failure = toFailure(failureType);

    await CancellationScope.nonCancellable(async () => {
      if (isChargeSent && failureType !== OrderPlaceFailureTypeEnum.PAYMENT_REJECTED) {
        await refundCustomer(charge);
      }

      if (failureType !== OrderPlaceFailureTypeEnum.INSUFFICIENT_STOCK) {
        await releaseStock(input.orderPublicId);
      }

      await markFailed(input.orderId, failure);
    });

    if (failureType === undefined) {
      throw error;
    }

    return failure.status;
  }

  await markPaid(input.orderId);
  
  return OrderStatusEnum.paid;
}

function toFailureType(error: unknown): OrderPlaceFailureTypeEnum | undefined {
  const cause = error instanceof ActivityFailure ? error.cause : undefined;

  if (cause instanceof ApplicationFailure) {
    return Object.values(OrderPlaceFailureTypeEnum).find((type) => type === cause.type);
  }

  return undefined;
}

function toFailure(failureType: OrderPlaceFailureTypeEnum | undefined): OrderFailureInterface {
  if (failureType === OrderPlaceFailureTypeEnum.INSUFFICIENT_STOCK) {
    return { status: OrderStatusEnum.canceled, reason: 'insufficient_stock' };
  }

  if (failureType === OrderPlaceFailureTypeEnum.PAYMENT_REJECTED) {
    return { status: OrderStatusEnum.failed_payment, reason: 'payment_rejected' };
  }

  return { status: OrderStatusEnum.canceled, reason: 'error' };
}
