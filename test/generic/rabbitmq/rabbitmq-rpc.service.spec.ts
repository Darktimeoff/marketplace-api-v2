import { describe, expect, it, vi } from 'vitest';
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqRpcService } from '../../../src/generic/rabbitmq/rabbitmq-rpc.service.js';

const chargeId = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';

describe('RabbitMqRpcService', () => {
  it('sends the call as a CloudEvent keyed by its id, expiring with the timeout, and answers only the reply data', async () => {
    const request = vi.fn().mockResolvedValue({ data: { status: 'success' } });
    const rpc = new RabbitMqRpcService({ request } as unknown as AmqpConnection);

    const response = await rpc.request({
      exchange: 'account.rpc',
      method: 'account.customer.charge',
      source: '/order-service',
      id: chargeId,
      data: { chargeId, customerPublicId: '9c82efe4-36c4-4767-b525-42e95cdbc5a3', amount: '160.00' },
    });

    expect(response).toEqual({ status: 'success' });
    expect(request).toHaveBeenCalledWith({
      exchange: 'account.rpc',
      routingKey: 'account.customer.charge',
      timeout: 5000,
      expiration: 5000,
      payload: {
        specversion: '1.0',
        id: chargeId,
        source: '/order-service',
        type: 'account.customer.charge',
        time: expect.any(String),
        datacontenttype: 'application/json',
        subject: chargeId,
        correlationid: chargeId,
        data: { chargeId, customerPublicId: '9c82efe4-36c4-4767-b525-42e95cdbc5a3', amount: '160.00' },
      },
    });
  });
});
