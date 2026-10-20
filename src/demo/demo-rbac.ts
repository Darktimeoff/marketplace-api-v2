// TODO(hw-24): remove after homework, npm run demo:rbac
import { setTimeout as sleep } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { CountryCodeEnum, CurrencyEnum, LanguageEnum } from '@marketplace/contracts-core';
import { run, report, type DemoClient, type DemoResponseInterface } from './demo-harness.js';

const SELLER = { login: 'seller1@example.com', password: 'marketplace-dev' };

function tamperRole(token: string): string {
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return [header, Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url'), signature].join('.');
}

async function placeOrderOnceProvisioned(client: DemoClient, token: string, offerId: number): Promise<DemoResponseInterface> {
  const deadline = Date.now() + 60_000;
  const body = {
    recipient: {
      fullName: 'Demo Buyer',
      phone: { countryCode: CountryCodeEnum.UA, rawNumber: '+380501234567', fullNumber: '+380501234567', nationalNumber: '0501234567' },
      address: { addressLine: 'Khreshchatyk St, 1', city: 'Kyiv' },
    },
    items: [{ offerId, quantity: 1 }],
    currency: CurrencyEnum.UAH,
  };

  while (true) {
    const placed = await client.call('POST', '/order', { token, body });
    if (placed.status !== 409 || Date.now() > deadline) {
      return placed;
    }
    await sleep(500);
  }
}

await run(async (client) => {
  const dataSource = client.app.get(DataSource);
  const [offer] = await dataSource.query(`SELECT "id" FROM "SellerOffer" WHERE "onHandQuantity" - "reservedQuantity" > 0 ORDER BY "id" LIMIT 1`);
  const [category] = await dataSource.query(`SELECT "id" FROM "Category" ORDER BY "id" LIMIT 1`);
  const [brand] = await dataSource.query(`SELECT "id" FROM "Brand" ORDER BY "id" LIMIT 1`);

  if (!offer || !category || !brand) {
    throw new Error('no seeded offer, category or brand: run npm run seed first');
  }

  const owner = await client.register();
  const stranger = await client.register();
  const seller = await client.call('POST', '/auth/login', { body: SELLER });

  if (seller.status !== 200) {
    throw new Error(`seller login failed with ${seller.status}: run npm run seed first`);
  }

  const placed = await placeOrderOnceProvisioned(client, owner.accessToken, offer.id);
  const orderPath = `/order/${placed.body.id}`;
  const product = { categoryId: category.id, brandId: brand.id, translations: [{ language: LanguageEnum.en, title: 'Demo kettle' }] };

  const anon = await client.call('GET', orderPath);
  const own = await client.call('GET', orderPath, { token: owner.accessToken });
  const foreign = await client.call('GET', orderPath, { token: stranger.accessToken });
  const roleDenied = await client.call('POST', '/product', { token: owner.accessToken, body: product });
  const roleAllowed = await client.call('POST', '/product', { token: String(seller.body.accessToken), body: product });
  const tampered = await client.call('POST', '/product', { token: tamperRole(owner.accessToken), body: product });

  if (roleAllowed.status === 201) {
    await dataSource.query(`DELETE FROM "Product" WHERE "publicId" = $1`, [roleAllowed.body.publicId]);
  }

  return report(
    {
      'order-placed': placed.status,
      anon: anon.status,
      own: own.status,
      foreign: foreign.status,
      'role-denied': roleDenied.status,
      'role-allowed': roleAllowed.status,
      tampered: tampered.status,
    },
    [
      ['the buyer placed an order', placed.status === 202],
      ['no token is 401', anon.status === 401],
      ['the owner reads the order', own.status === 200],
      ['another buyer gets 403, not 401', foreign.status === 403],
      ['a buyer cannot create products', roleDenied.status === 403],
      ['a seller can', roleAllowed.status === 200 || roleAllowed.status === 201],
      ['a forged payload is 401', tampered.status === 401],
    ],
  );
});
