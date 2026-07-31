import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDiscoveryListingSigner,
  buildDiscoveryListingOrder,
  buildDiscoveryListingRequirements,
  buildDiscoveryListingSpendControls,
  checkDiscoveryDescription,
  checkDiscoveryExtension,
  DISCOVERY_LISTING,
  DISCOVERY_LISTING_EXECUTION_SENTINEL,
  DISCOVERY_LISTING_SELF_MARKER,
  discoveryListingExecutionErrors,
  evaluateDiscoveryListingChallenge,
  findDiscoveryListing,
  judgeIndexing,
  validateDiscoveryListingPaymentPayload,
  validatePendingDiscoveryListing,
  type PendingDiscoveryListingPayment,
} from '../lib/discovery-listing.ts'
import { buildPaymentRequired, OrderInputSchema, parsePrepurchaseConfig } from '../lib/prepurchase.ts'
import { encodeBase64Json } from '../lib/x402.ts'

const NONCE = `0x${'ab'.repeat(32)}`
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111'

const fullEnv = {
  DISCOVERY_LISTING_EXECUTE: DISCOVERY_LISTING_EXECUTION_SENTINEL,
  CDP_API_KEY_ID: 'id',
  CDP_API_KEY_SECRET: 'secret',
  CDP_WALLET_SECRET: 'wallet',
}

/**
 * Le défi de référence est celui que NOTRE PROPRE route produit, pas un
 * littéral recopié à la main : si la route change de forme, ce test le voit.
 */
function productionChallenge() {
  const parsed = parsePrepurchaseConfig({
    PREPURCHASE_ENABLED: 'true',
    PREPURCHASE_PAY_TO: DISCOVERY_LISTING.recipient,
    PREPURCHASE_NETWORK: DISCOVERY_LISTING.network,
    PREPURCHASE_MAINNET_ACK: 'I-UNDERSTAND-THIS-ACCEPTS-REAL-USDC-ON-BASE-MAINNET',
    CDP_API_KEY_ID: 'id',
    CDP_API_KEY_SECRET: 'secret',
  })
  assert.ok(parsed.ok, 'the mainnet reference config must parse')
  return buildPaymentRequired(parsed.config)
}

function headerFor(mutate: (challenge: Record<string, unknown>) => void = () => {}) {
  const challenge = productionChallenge() as unknown as Record<string, unknown>
  mutate(challenge)
  return encodeBase64Json(challenge)
}

test('the live production challenge shape is accepted', () => {
  const result = evaluateDiscoveryListingChallenge({
    challengeStatus: 402,
    paymentRequiredHeader: headerFor(),
  })
  assert.equal(result.ok, true, result.ok ? '' : result.reason)
})

test('an inactive offer (503) blocks before anything else is read', () => {
  const result = evaluateDiscoveryListingChallenge({
    challengeStatus: 503,
    paymentRequiredHeader: null,
  })
  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /503/)
})

test('a challenge that names another recipient is refused, not followed', () => {
  const result = evaluateDiscoveryListingChallenge({
    challengeStatus: 402,
    paymentRequiredHeader: headerFor((challenge) => {
      const accepts = challenge.accepts as Record<string, unknown>[]
      accepts[0].payTo = OTHER_ADDRESS
    }),
  })
  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /recipient-is-our-pinned-receiver/)
})

test('a testnet challenge is refused even if everything else matches', () => {
  const result = evaluateDiscoveryListingChallenge({
    challengeStatus: 402,
    paymentRequiredHeader: headerFor((challenge) => {
      const accepts = challenge.accepts as Record<string, unknown>[]
      accepts[0].network = 'eip155:84532'
    }),
  })
  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /network-is-base-mainnet/)
})

test('a different amount is refused rather than paid', () => {
  const result = evaluateDiscoveryListingChallenge({
    challengeStatus: 402,
    paymentRequiredHeader: headerFor((challenge) => {
      const accepts = challenge.accepts as Record<string, unknown>[]
      accepts[0].amount = '1000000'
    }),
  })
  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /amount-is-exactly-the-offer-price/)
})

test('a challenge without discovery metadata is refused: paying it would index nothing, silently', () => {
  const result = evaluateDiscoveryListingChallenge({
    challengeStatus: 402,
    paymentRequiredHeader: headerFor((challenge) => {
      delete challenge.extensions
    }),
  })
  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /discovery-extension-declared/)
})

test('the production description is within the facilitator cap in both units', () => {
  const challenge = productionChallenge()
  const checks = checkDiscoveryDescription(challenge.resource.description)
  assert.ok(checks.every((check) => check.ok), JSON.stringify(checks))
})

test('a description over the cap is refused in characters and in bytes', () => {
  const overByChars = checkDiscoveryDescription('a'.repeat(DISCOVERY_LISTING.descriptionMaxLength + 1))
  assert.ok(overByChars.some((check) => check.name === 'discovery-description-within-cap' && !check.ok))

  // 260 caractères mais 520 octets : le contrôle en caractères seul laisserait passer.
  const overByBytes = checkDiscoveryDescription('é'.repeat(260))
  assert.ok(overByBytes.some((check) => check.name === 'discovery-description-within-cap' && !check.ok))
})

test('an empty description is refused', () => {
  const checks = checkDiscoveryDescription('   ')
  assert.ok(checks.some((check) => check.name === 'discovery-description-present' && !check.ok))
})

test('the production discovery extension passes the official validators', () => {
  const challenge = productionChallenge()
  const checks = checkDiscoveryExtension(challenge.extensions)
  assert.ok(checks.every((check) => check.ok), JSON.stringify(checks))
})

test('a malformed discovery extension is reported, not tolerated', () => {
  const checks = checkDiscoveryExtension({ bazaar: { info: { input: { type: 'http' } } } })
  assert.ok(checks.some((check) => !check.ok))
})

test('execution stays refused until both flags and the exact sentinel are present', () => {
  assert.deepEqual(
    discoveryListingExecutionErrors({ execute: true, authorizeFlag: true, env: fullEnv }),
    [],
  )
  assert.ok(
    discoveryListingExecutionErrors({ execute: false, authorizeFlag: true, env: fullEnv }).some((e) =>
      e.includes('--execute'),
    ),
  )
  assert.ok(
    discoveryListingExecutionErrors({ execute: true, authorizeFlag: false, env: fullEnv }).some((e) =>
      e.includes('--i-authorize-discovery-listing-payment'),
    ),
  )
  assert.ok(
    discoveryListingExecutionErrors({
      execute: true,
      authorizeFlag: true,
      env: { ...fullEnv, DISCOVERY_LISTING_EXECUTE: 'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-ON-BASE-MAINNET' },
    }).some((e) => e.includes('DISCOVERY_LISTING_EXECUTE')),
    'the mainnet acceptance sentinel must not unlock this tool',
  )
})

test('missing CDP credentials are named individually', () => {
  const errors = discoveryListingExecutionErrors({
    execute: true,
    authorizeFlag: true,
    env: { DISCOVERY_LISTING_EXECUTE: DISCOVERY_LISTING_EXECUTION_SENTINEL },
  })
  assert.ok(errors.some((e) => e.includes('CDP_API_KEY_ID')))
  assert.ok(errors.some((e) => e.includes('CDP_API_KEY_SECRET')))
  assert.ok(errors.some((e) => e.includes('CDP_WALLET_SECRET')))
})

test('spend controls cannot let more than one payment leave', () => {
  const controls = buildDiscoveryListingSpendControls()
  assert.equal(controls.maxAmountPerPayment.atomic, BigInt(DISCOVERY_LISTING.amountAtomic))
  assert.equal(controls.maxCumulativeSpend.atomic, BigInt(DISCOVERY_LISTING.amountAtomic))
  assert.deepEqual(controls.allowedNetworks, [DISCOVERY_LISTING.network])
  assert.deepEqual(controls.allowedAssets, [DISCOVERY_LISTING.asset])
  assert.deepEqual(controls.allowedPayees, [DISCOVERY_LISTING.recipient])
})

function signedPayload(overrides: Record<string, unknown> = {}) {
  const required = buildDiscoveryListingRequirements()
  return {
    x402Version: 2,
    accepted: { ...required, ...overrides },
    payload: {
      signature: '0xabcdef',
      authorization: {
        from: DISCOVERY_LISTING.buyerAddress,
        to: DISCOVERY_LISTING.recipient,
        value: DISCOVERY_LISTING.amountAtomic,
        validAfter: '0',
        validBefore: '99999999999',
        nonce: NONCE,
        ...(overrides.authorization as Record<string, unknown> | undefined),
      },
    },
  }
}

test('a conforming signed payload is accepted and reports its payer and nonce', () => {
  const result = validateDiscoveryListingPaymentPayload(signedPayload())
  assert.equal(result.ok, true)
  assert.equal(result.ok ? result.payer : null, DISCOVERY_LISTING.buyerAddress)
  assert.equal(result.ok ? result.nonce : null, NONCE)
})

test('a payload that would pay someone else is refused after signing', () => {
  const payload = signedPayload()
  payload.payload.authorization.to = OTHER_ADDRESS
  const result = validateDiscoveryListingPaymentPayload(payload)
  assert.equal(result.ok, false)
})

test('a payload carrying the wrong value is refused after signing', () => {
  const payload = signedPayload()
  payload.payload.authorization.value = '1'
  const result = validateDiscoveryListingPaymentPayload(payload)
  assert.equal(result.ok, false)
})

test('the signing wallet must be the pinned buyer, not merely self-consistent', () => {
  assert.equal(
    assertDiscoveryListingSigner(DISCOVERY_LISTING.buyerAddress, DISCOVERY_LISTING.buyerAddress),
    null,
  )
  assert.ok(assertDiscoveryListingSigner(OTHER_ADDRESS, OTHER_ADDRESS)?.includes('pinned buyer'))
  assert.ok(
    assertDiscoveryListingSigner(DISCOVERY_LISTING.buyerAddress, OTHER_ADDRESS)?.includes('do not match'),
  )
  assert.ok(assertDiscoveryListingSigner('not-an-address', OTHER_ADDRESS))
})

function pending(overrides: Partial<PendingDiscoveryListingPayment> = {}) {
  return {
    version: 1,
    case: 'discovery-listing',
    created_at: new Date().toISOString(),
    endpoint: DISCOVERY_LISTING.endpoint,
    request_body: buildDiscoveryListingOrder(),
    payment_signature_header: 'header',
    payer: DISCOVERY_LISTING.buyerAddress,
    nonce: NONCE,
    amount_atomic: DISCOVERY_LISTING.amountAtomic,
    network: DISCOVERY_LISTING.network,
    asset: DISCOVERY_LISTING.asset,
    recipient: DISCOVERY_LISTING.recipient,
    ...overrides,
  }
}

test('a well-formed recovery file replays', () => {
  assert.equal(validatePendingDiscoveryListing(pending()), null)
})

test('a recovery file pointing elsewhere is refused rather than replayed', () => {
  assert.ok(validatePendingDiscoveryListing(pending({ endpoint: 'https://example.com/x' })))
  assert.ok(validatePendingDiscoveryListing(pending({ recipient: OTHER_ADDRESS })))
  assert.ok(validatePendingDiscoveryListing(pending({ network: 'eip155:84532' })))
  assert.ok(validatePendingDiscoveryListing(pending({ amount_atomic: '1' })))
  assert.ok(validatePendingDiscoveryListing(pending({ case: 'case-002' as never })))
})

test('a completed proof cannot be replayed as an authorization', () => {
  const proof = pending()
  delete (proof as Partial<PendingDiscoveryListingPayment>).payment_signature_header
  assert.match(String(validatePendingDiscoveryListing(proof)), /no signed authorization/)
})

test('the catalog lookup matches only our exact resource URL', () => {
  const found = findDiscoveryListing([
    { resource: 'https://elsewhere.example/api' },
    { resource: DISCOVERY_LISTING.endpoint, type: 'http' },
  ])
  assert.equal(found.listed, true)
  assert.equal(found.scanned, 2)

  const nearMiss = findDiscoveryListing([{ resource: 'https://agentreputation.dev/api/other' }])
  assert.equal(nearMiss.listed, false)
  assert.deepEqual(nearMiss.nearMisses, ['https://agentreputation.dev/api/other'])

  assert.equal(findDiscoveryListing(null).listed, false)
})

test('indexing is judged against the announced window, not against impatience', () => {
  const settledAt = '2026-07-30T10:00:00.000Z'
  assert.equal(
    judgeIndexing({ listed: true, settledAt, now: new Date('2026-07-30T10:05:00.000Z') }).verdict,
    'listed',
  )
  assert.equal(
    judgeIndexing({ listed: false, settledAt, now: new Date('2026-07-30T13:00:00.000Z') }).verdict,
    'pending',
  )
  assert.equal(
    judgeIndexing({ listed: false, settledAt, now: new Date('2026-07-30T20:00:00.000Z') }).verdict,
    'overdue',
  )
  assert.equal(
    judgeIndexing({ listed: false, settledAt: null, now: new Date() }).verdict,
    'unknown_settlement',
  )
  // Le facilitateur ignore ses propres filtres et le catalogue dépasse 15 000
  // entrées : une absence constatée sur un parcours partiel ne prouve rien, même
  // longtemps après la fenêtre d'indexation.
  assert.equal(
    judgeIndexing({
      listed: false,
      settledAt,
      now: new Date('2026-08-15T00:00:00.000Z'),
      scanComplete: false,
    }).verdict,
    'inconclusive_scan',
  )
  assert.equal(
    judgeIndexing({ listed: true, settledAt, now: new Date(), scanComplete: false }).verdict,
    'listed',
    'finding the entry is conclusive even on a partial scan',
  )
  assert.equal(
    judgeIndexing({ listed: false, settledAt: 'not-a-date', now: new Date() }).verdict,
    'unknown_settlement',
  )
})

test('the order body declares itself as a self-purchase and passes the seller schema', () => {
  const order = buildDiscoveryListingOrder()
  assert.ok(order.candidate.includes(DISCOVERY_LISTING_SELF_MARKER))
  // Le vendeur refuserait un corps non conforme : on le vérifie contre SON schéma.
  assert.equal(OrderInputSchema.safeParse(order).success, true)
})
