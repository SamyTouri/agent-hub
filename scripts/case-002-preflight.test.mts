import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCase002ResourceUrl,
  CASE002_PREFLIGHT,
  evaluateCase002Challenge,
  evaluateCase002Manifest,
  resolveCase002SellerBase,
} from '../lib/case002-preflight.ts'

function encodeHeader(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

const sellerBase = 'https://current-seller.trycloudflare.com'
const resourceUrl = buildCase002ResourceUrl(sellerBase)

test('resolves exactly one live seller host from the directory profile', () => {
  assert.equal(
    resolveCase002SellerBase(`<a href="${sellerBase}/.well-known/agent-card.json">card</a>`),
    sellerBase,
  )
  assert.throws(() => resolveCase002SellerBase('<html>none</html>'), /exactly one/)
  assert.throws(
    () =>
      resolveCase002SellerBase(
        `${sellerBase} https://second-seller.trycloudflare.com`,
      ),
    /exactly one/,
  )
})

test('accepts only the fixed manifest product, price and recipient', () => {
  const good = evaluateCase002Manifest({
    payTo: CASE002_PREFLIGHT.recipient,
    endpoints: [
      {
        path: CASE002_PREFLIGHT.productPath,
        method: 'GET',
        price: CASE002_PREFLIGHT.advertisedPrice,
      },
    ],
  })
  assert.equal(good.ok, true)

  const repriced = evaluateCase002Manifest({
    payTo: CASE002_PREFLIGHT.recipient,
    endpoints: [
      {
        path: CASE002_PREFLIGHT.productPath,
        method: 'GET',
        price: '$0.06',
      },
    ],
  })
  assert.equal(repriced.ok, false)
})

test('accepts an exact v2 challenge bound to the fixed GET resource', () => {
  const result = evaluateCase002Challenge(
    encodeHeader({
      x402Version: 2,
      resource: { url: resourceUrl, mimeType: 'application/json' },
      accepts: [
        {
          scheme: 'exact',
          network: CASE002_PREFLIGHT.network,
          amount: CASE002_PREFLIGHT.amountAtomic,
          asset: CASE002_PREFLIGHT.asset,
          payTo: CASE002_PREFLIGHT.recipient,
        },
      ],
    }),
    resourceUrl,
  )
  assert.equal(result.ok, true)
})

test('fails closed on a lower price or a challenge bound to another resource', () => {
  const lowerPrice = evaluateCase002Challenge(
    encodeHeader({
      x402Version: 2,
      resource: { url: resourceUrl },
      accepts: [
        {
          scheme: 'exact',
          network: CASE002_PREFLIGHT.network,
          amount: '49999',
          asset: CASE002_PREFLIGHT.asset,
          payTo: CASE002_PREFLIGHT.recipient,
        },
      ],
    }),
    resourceUrl,
  )
  assert.equal(lowerPrice.ok, false)

  const otherResource = evaluateCase002Challenge(
    encodeHeader({
      x402Version: 2,
      resource: { url: `${sellerBase}/v1/other` },
      accepts: [
        {
          scheme: 'exact',
          network: CASE002_PREFLIGHT.network,
          amount: CASE002_PREFLIGHT.amountAtomic,
          asset: CASE002_PREFLIGHT.asset,
          payTo: CASE002_PREFLIGHT.recipient,
        },
      ],
    }),
    resourceUrl,
  )
  assert.equal(otherResource.ok, false)
})

const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111'

function challengeWith(accepted: Record<string, unknown>) {
  return evaluateCase002Challenge(
    encodeHeader({ x402Version: 2, resource: { url: resourceUrl }, accepts: [accepted] }),
    resourceUrl,
  )
}

test('challenge fails closed on a wrong recipient, network or asset', () => {
  const good = {
    scheme: 'exact',
    network: CASE002_PREFLIGHT.network,
    amount: CASE002_PREFLIGHT.amountAtomic,
    asset: CASE002_PREFLIGHT.asset,
    payTo: CASE002_PREFLIGHT.recipient,
  }
  assert.equal(challengeWith(good).ok, true)
  assert.equal(challengeWith({ ...good, payTo: OTHER_ADDRESS }).ok, false)
  assert.equal(challengeWith({ ...good, network: 'eip155:84532' }).ok, false)
  assert.equal(challengeWith({ ...good, asset: OTHER_ADDRESS }).ok, false)
  assert.equal(challengeWith({ ...good, scheme: 'upto' }).ok, false)
  // A higher price also fails closed, not only a lower one: any price change blocks.
  assert.equal(challengeWith({ ...good, amount: '50001' }).ok, false)
})

test('challenge fails closed on a missing or unparseable PAYMENT-REQUIRED header', () => {
  assert.equal(evaluateCase002Challenge(null, resourceUrl).ok, false)
  assert.equal(evaluateCase002Challenge('not+base64+json!!', resourceUrl).ok, false)
})

test('manifest fails closed when the recipient changes', () => {
  const moved = evaluateCase002Manifest({
    payTo: OTHER_ADDRESS,
    endpoints: [
      { path: CASE002_PREFLIGHT.productPath, method: 'GET', price: CASE002_PREFLIGHT.advertisedPrice },
    ],
  })
  assert.equal(moved.ok, false)
})

test('manifest fails closed when the product is POST instead of GET', () => {
  const wrongMethod = evaluateCase002Manifest({
    payTo: CASE002_PREFLIGHT.recipient,
    endpoints: [
      { path: CASE002_PREFLIGHT.productPath, method: 'POST', price: CASE002_PREFLIGHT.advertisedPrice },
    ],
  })
  assert.equal(wrongMethod.ok, false)
})

test('resolver ignores non-trycloudflare hosts and fails closed', () => {
  assert.throws(() => resolveCase002SellerBase('<a href="https://evil.example.com/x">x</a>'), /exactly one/)
})
