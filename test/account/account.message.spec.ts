import { describe, expect, it } from 'vitest';
import { AccountCustomerChargeRpc, type CloudEventInterface } from '@marketplace/messaging-contracts';
import { AccountMessage } from '../../src/account/message/account.message.js';

const chargeId = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';

describe('AccountMessage', () => {
  const messages = new AccountMessage();

  it('builds the charge reply as a cloudevent correlated to the request', () => {
    const request = {
      specversion: '1.0',
      id: chargeId,
      source: '/order-service',
      type: AccountCustomerChargeRpc.METHOD,
      time: '2026-11-01T10:00:00.000Z',
      datacontenttype: 'application/json',
      subject: chargeId,
      correlationid: chargeId,
      data: { chargeId, customerPublicId: '9c82efe4-36c4-4767-b525-42e95cdbc5a3', amount: '160.00' },
    } as CloudEventInterface<string, AccountCustomerChargeRpc.RequestInterface>;
    const data = { status: 'rejected', reason: 'insufficient_amount', available: '10.00' } as const;

    expect(messages.toChargeReply(request, data)).toEqual({
      specversion: '1.0',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      source: '/account-service',
      type: 'account.customer.charge.response',
      time: expect.any(String),
      datacontenttype: 'application/json',
      subject: chargeId,
      correlationid: chargeId,
      data,
    });
    expect(messages.toChargeReply(request, data).id).not.toBe(chargeId);
  });
});
