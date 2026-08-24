import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PactV3, MatchersV3 } from '@pact-foundation/pact'

const { like, integer } = MatchersV3
const dirname = path.dirname(fileURLToPath(import.meta.url))

const provider = new PactV3({
  consumer: 'marketplace-web',
  provider: 'marketplace-api',
  dir: path.resolve(dirname, 'pacts'),
})

test('GET /products/{id} returns the product together with its category breadcrumbs', async () => {
  provider
    .given('product 1 exists in category "phones"')
    .uponReceiving('a request for product 1')
    .withRequest({
      method: 'GET',
      path: '/products/1',
      headers: { Accept: 'application/json' },
    })
    .willRespondWith({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        data: {
          product: {
            title: like('iPhone 15'),
            slug: like('iphone-15'),
            price_cents: integer(2600000),
            oldPrice_cents: null,
            brand: {
              name: like('Apple'),
              slug: like('apple'),
            },
            media: like([
              {
                url: like('https://cdn.example.com/media/1.jpg'),
                format: like('JPEG'),
                type: like('IMAGE'),
              },
            ]),
          },
          breadcrumbs: like([
            { id: integer(1), slug: like('phones'), name: like('Phones') },
          ]),
        },
        error: null,
      },
    })

  await provider.executeTest(async (mockServer) => {
    const response = await fetch(`${mockServer.url}/products/1`, {
      headers: { Accept: 'application/json' },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.error, null)
    assert.equal(body.data.product.title, 'iPhone 15')
    assert.equal(body.data.breadcrumbs[0].slug, 'phones')
  })
})
