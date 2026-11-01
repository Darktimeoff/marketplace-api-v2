import { describe, expect, it, vi } from 'vitest';
import { AccountClient } from '../../src/order/client/account.client.js';
import { SellerOfferClient } from '../../src/order/client/seller-offer.client.js';
import type { SellerOfferService } from '../../src/seller-offer/service/seller-offer.service.js';
import type { SellerOfferStockReserveCommandHandler } from '../../src/seller-offer/command-handler/seller-offer-stock-reserve.command-handler.js';
import type { SellerOfferStockReleaseCommandHandler } from '../../src/seller-offer/command-handler/seller-offer-stock-release.command-handler.js';
import type { RabbitMqRpcService } from '../../src/generic/rabbitmq/rabbitmq-rpc.service.js';
import type { AccountCustomerRefundCommandHandler } from '../../src/account/command-handler/account-customer-refund.command-handler.js';

const order = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';
const buyer = '9c82efe4-36c4-4767-b525-42e95cdbc5a3';
const offer = '45b4b670-96f8-4cc3-9a2c-a9e284bb2551';

describe('order clients', () => {
  it('reserves and releases stock through seller-offer, answering its response unchanged', async () => {
    const reserve = vi.fn().mockResolvedValue({ status: 'rejected', reason: 'insufficient_stock', items: [{ offerPublicId: offer, quantity: 2, available: 1 }] });
    const release = vi.fn().mockResolvedValue({ status: 'released', offers: 1 });
    const client = new SellerOfferClient(
      {} as SellerOfferService,
      { execute: reserve } as unknown as SellerOfferStockReserveCommandHandler,
      { execute: release } as unknown as SellerOfferStockReleaseCommandHandler,
    );

    expect(await client.reserveStock({ orderPublicId: order, items: [{ offerPublicId: offer, quantity: 2 }] })).toEqual({
      status: 'rejected',
      reason: 'insufficient_stock',
      items: [{ offerPublicId: offer, quantity: 2, available: 1 }],
    });
    expect(await client.releaseStock({ orderPublicId: order })).toEqual({ status: 'released', offers: 1 });
    expect(reserve).toHaveBeenCalledWith({ orderPublicId: order, items: [{ offerPublicId: offer, quantity: 2 }] });
    expect(release).toHaveBeenCalledWith({ orderPublicId: order });
  });

  it('charges over the account commands exchange and refunds in process, by the charge id', async () => {
    const charge = vi.fn().mockResolvedValue({ status: 'success' });
    const refund = vi.fn().mockResolvedValue({ status: 'not_charged' });
    const client = new AccountClient(
      { request: charge } as unknown as RabbitMqRpcService,
      { execute: refund } as unknown as AccountCustomerRefundCommandHandler,
    );
    const request = { chargeId: order, customerPublicId: buyer, amount: '160.00' };

    expect(await client.charge(request)).toEqual({ status: 'success' });
    expect(await client.refund(request)).toEqual({ status: 'not_charged' });
    expect(charge).toHaveBeenCalledWith({
      exchange: 'account.commands',
      method: 'account.customer.charge',
      source: '/order-service',
      id: order,
      data: request,
    });
    expect(refund).toHaveBeenCalledWith(request);
  });
});
