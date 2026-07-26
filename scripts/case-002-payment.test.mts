import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCase002ResourceUrl, CASE002_PREFLIGHT } from '../lib/case002-preflight.ts'
import {
  assertSigningWalletMatches,
  buildCase002SellerRequirements,
  buildCase002SpendControls,
  CASE002_EXECUTION_SENTINEL,
  CASE002_PAYMENT,
  case002AuthorizationErrors,
  revalidateCase002,
  summarizeCase002Delivery,
  validateCase002PaymentPayload,
  validatePendingCase002,
  type PendingCase002Payment,
} from '../lib/case002-payment.ts'

const SELLER_BASE = 'https://current-seller.trycloudflare.com'
const RESOURCE_URL = buildCase002ResourceUrl(SELLER_BASE)
const WALLET = '0x5F3C44C54585fC96aA8E636BA4cF2bc438934c63'
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111'
const NONCE = '0x' + 'ab'.repeat(32)

const fullEnv = {
  CASE002_EXECUTE: CASE002_EXECUTION_SENTINEL,
  CDP_API_KEY_ID: 'id',
  CDP_API_KEY_SECRET: 'secret',
  CDP_WALLET_SECRET: 'wallet',
}

function encodeHeader(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

function challengeHeader(overrides: Record<string, unknown> = {}, resourceUrl = RESOURCE_URL) {
  return encodeHeader({
    x402Version: 2,
    resource: { url: resourceUrl, mimeType: 'application/json' },
    accepts: [
      {
        scheme: 'exact',
        network: CASE002_PAYMENT.network,
        amount: CASE002_PAYMENT.amountAtomic,
        asset: CASE002_PAYMENT.asset,
        payTo: CASE002_PAYMENT.recipient,
        ...overrides,
      },
    ],
  })
}

function goodManifest() {
  return {
    payTo: CASE002_PAYMENT.recipient,
    endpoints: [
      {
        path: CASE002_PREFLIGHT.productPath,
        method: 'GET',
        price: CASE002_PREFLIGHT.advertisedPrice,
      },
    ],
  }
}

function revalidationInput(overrides: Partial<Parameters<typeof revalidateCase002>[0]> = {}) {
  return {
    profileStatus: 200,
    profileHtml: `<a href="${SELLER_BASE}/.well-known/agent-card.json">card</a>`,
    manifestStatus: 200,
    manifest: goodManifest(),
    challengeStatus: 402,
    paymentRequiredHeader: challengeHeader(),
    ...overrides,
  }
}

function signedPayload(overrides?: {
  accepted?: Record<string, unknown>
  authorization?: Record<string, unknown>
}) {
  const accepted = { ...buildCase002SellerRequirements(), ...overrides?.accepted }
  return {
    x402Version: 2,
    accepted,
    payload: {
      signature: '0x' + 'cd'.repeat(65),
      authorization: {
        from: WALLET,
        to: CASE002_PAYMENT.recipient,
        value: accepted.amount,
        validAfter: '0',
        validBefore: '9999999999',
        nonce: NONCE,
        ...overrides?.authorization,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Authorization gates
// ---------------------------------------------------------------------------

test('the consumed authorization keeps the buyer permanently inert', () => {
  assert.ok(
    case002AuthorizationErrors({ execute: true, authorizeFlag: true, env: fullEnv }).some(
      (error) => error.includes('authorization was consumed'),
    ),
  )
})

test('the buyer also requires both flags and the exact sentinel', () => {
  assert.ok(
    case002AuthorizationErrors({ execute: false, authorizeFlag: true, env: fullEnv }).includes(
      'missing --execute',
    ),
  )
  assert.ok(
    case002AuthorizationErrors({ execute: true, authorizeFlag: false, env: fullEnv }).length > 0,
  )
  // A near-miss sentinel must not authorize anything.
  for (const wrong of ['', 'yes', CASE002_EXECUTION_SENTINEL.toLowerCase(), `${CASE002_EXECUTION_SENTINEL} `]) {
    assert.ok(
      case002AuthorizationErrors({
        execute: true,
        authorizeFlag: true,
        env: { ...fullEnv, CASE002_EXECUTE: wrong },
      }).length > 0,
      `sentinel "${wrong}" must be refused`,
    )
  }
})

test('a Case-001 sentinel can never authorize a Case-002 payment', () => {
  const errors = case002AuthorizationErrors({
    execute: true,
    authorizeFlag: true,
    env: { ...fullEnv, CASE002_EXECUTE: 'I-AUTHORIZE-EXACTLY-1-USDC-FOR-AGENT-REPUTATION-CASE-001' },
  })
  assert.ok(errors.length > 0)
})

test('missing CDP credentials keep the buyer inert', () => {
  for (const key of ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET']) {
    const env = { ...fullEnv, [key]: undefined }
    assert.ok(
      case002AuthorizationErrors({ execute: true, authorizeFlag: true, env }).some((error) =>
        error.includes(key),
      ),
    )
  }
})

// ---------------------------------------------------------------------------
// Spend controls and fixed scope
// ---------------------------------------------------------------------------

test('spend controls cannot allow more than this single 0.05 USDC purchase', () => {
  const controls = buildCase002SpendControls()
  assert.equal(controls.maxAmountPerPayment.atomic, 50_000n)
  assert.equal(controls.maxCumulativeSpend.atomic, 50_000n)
  assert.equal(controls.maxCumulativeSpendWindow, '24h')
  assert.deepEqual(controls.allowedNetworks, ['eip155:8453'])
  assert.deepEqual(controls.allowedAssets, [CASE002_PAYMENT.asset])
  // The payee is the seller, never one of our own receiving accounts.
  assert.deepEqual(controls.allowedPayees, [CASE002_PAYMENT.recipient])
})

test('the authorized scope stays exactly what Samy approved', () => {
  assert.equal(CASE002_PAYMENT.amountAtomic, '50000')
  assert.equal(CASE002_PAYMENT.network, 'eip155:8453')
  assert.equal(CASE002_PAYMENT.recipient, '0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E')
  assert.equal(CASE002_PAYMENT.targetUrl, 'https://agentreputation.dev/')
  // The already funded mainnet wallet is reused; no new account is provisioned.
  assert.equal(CASE002_PAYMENT.walletAccountName, 'aghub-prepurchase-mainnet-buyer')
  assert.match(RESOURCE_URL, /\/v1\/page-signals\?url=https%3A%2F%2Fagentreputation\.dev%2F$/)
})

// ---------------------------------------------------------------------------
// Same-session revalidation — fail closed on every material mutation
// ---------------------------------------------------------------------------

test('revalidation passes on the exact authorized offer', () => {
  const result = revalidateCase002(revalidationInput())
  assert.ok(result.ok)
  assert.equal(result.sellerBase, SELLER_BASE)
  assert.equal(result.resourceUrl, RESOURCE_URL)
})

test('revalidation stops on host ambiguity or an unreachable profile', () => {
  assert.equal(revalidateCase002(revalidationInput({ profileStatus: 503 })).ok, false)
  assert.equal(revalidateCase002(revalidationInput({ profileHtml: '<html>no host</html>' })).ok, false)
  assert.equal(
    revalidateCase002(
      revalidationInput({
        profileHtml: `${SELLER_BASE} https://second-host.trycloudflare.com`,
      }),
    ).ok,
    false,
  )
})

test('revalidation stops on a changed price, network, asset or recipient', () => {
  const mutations: Array<[string, Record<string, unknown>]> = [
    ['higher price', { amount: '50001' }],
    ['lower price', { amount: '49999' }],
    ['testnet', { network: 'eip155:84532' }],
    ['other asset', { asset: OTHER_ADDRESS }],
    ['other recipient', { payTo: OTHER_ADDRESS }],
    ['other scheme', { scheme: 'upto' }],
  ]
  for (const [label, override] of mutations) {
    const result = revalidateCase002(
      revalidationInput({ paymentRequiredHeader: challengeHeader(override) }),
    )
    assert.equal(result.ok, false, `${label} must stop before signing`)
  }
})

test('revalidation stops when the challenge is bound to another resource', () => {
  const result = revalidateCase002(
    revalidationInput({
      paymentRequiredHeader: challengeHeader({}, `${SELLER_BASE}/v1/homepage-diagnostic`),
    }),
  )
  assert.equal(result.ok, false)
})

test('revalidation stops on a changed product, method or manifest recipient', () => {
  assert.equal(
    revalidateCase002(
      revalidationInput({
        manifest: { payTo: CASE002_PAYMENT.recipient, endpoints: [{ path: '/v1/page-signals', method: 'POST', price: '$0.05' }] },
      }),
    ).ok,
    false,
  )
  assert.equal(
    revalidateCase002(
      revalidationInput({
        manifest: { payTo: CASE002_PAYMENT.recipient, endpoints: [{ path: '/v1/page-signals', method: 'GET', price: '$0.25' }] },
      }),
    ).ok,
    false,
  )
  assert.equal(
    revalidateCase002(revalidationInput({ manifest: { payTo: OTHER_ADDRESS, endpoints: [] } })).ok,
    false,
  )
})

test('revalidation stops when the unsigned resource does not answer 402', () => {
  assert.equal(revalidateCase002(revalidationInput({ challengeStatus: 200 })).ok, false)
  assert.equal(revalidateCase002(revalidationInput({ challengeStatus: 404 })).ok, false)
  assert.equal(revalidateCase002(revalidationInput({ paymentRequiredHeader: null })).ok, false)
})

// ---------------------------------------------------------------------------
// Post-signature validation
// ---------------------------------------------------------------------------

test('a payload matching the authorized purchase is accepted', () => {
  const result = validateCase002PaymentPayload(signedPayload())
  assert.ok(result.ok)
  assert.equal(result.payer, WALLET)
  assert.equal(result.nonce, NONCE)
})

test('a payload that drifts from the authorized purchase is refused after signing', () => {
  const mutations: Array<[string, ReturnType<typeof signedPayload>]> = [
    ['amount', signedPayload({ accepted: { amount: '1000000' }, authorization: { value: '1000000' } })],
    ['recipient', signedPayload({ accepted: { payTo: OTHER_ADDRESS } })],
    ['network', signedPayload({ accepted: { network: 'eip155:84532' } })],
    ['asset', signedPayload({ accepted: { asset: OTHER_ADDRESS } })],
    ['authorization.to', signedPayload({ authorization: { to: OTHER_ADDRESS } })],
    ['authorization.value', signedPayload({ authorization: { value: '60000' } })],
  ]
  for (const [label, payload] of mutations) {
    assert.equal(validateCase002PaymentPayload(payload).ok, false, `${label} must be refused`)
  }
  assert.equal(validateCase002PaymentPayload({ nonsense: true }).ok, false)
})

test('the signing wallet must be exactly the wallet we believe we are using', () => {
  assert.equal(assertSigningWalletMatches(WALLET, WALLET), null)
  assert.equal(assertSigningWalletMatches(WALLET, WALLET.toLowerCase()), null)
  assert.ok(assertSigningWalletMatches(WALLET, OTHER_ADDRESS))
  assert.ok(assertSigningWalletMatches('not-an-address', WALLET))
})

// ---------------------------------------------------------------------------
// Recovery — never a silent second authorization
// ---------------------------------------------------------------------------

function pendingFile(overrides: Partial<PendingCase002Payment> = {}): PendingCase002Payment {
  return {
    version: 1,
    case: 'case-002',
    created_at: '2026-07-26T10:00:00.000Z',
    resource_url: RESOURCE_URL,
    seller_base: SELLER_BASE,
    payment_signature_header: 'c2lnbmF0dXJl',
    payer: WALLET,
    nonce: NONCE,
    amount_atomic: CASE002_PAYMENT.amountAtomic,
    network: CASE002_PAYMENT.network,
    asset: CASE002_PAYMENT.asset,
    recipient: CASE002_PAYMENT.recipient,
    ...overrides,
  }
}

test('a recovery file is replayable only for the identical resolved purchase', () => {
  assert.equal(validatePendingCase002(pendingFile(), RESOURCE_URL), null)
  // A stale file pointing at the seller's previous host must not be replayed.
  assert.ok(
    validatePendingCase002(
      pendingFile({ resource_url: 'https://old-host.trycloudflare.com/v1/page-signals?url=x' }),
      RESOURCE_URL,
    ),
  )
  assert.ok(validatePendingCase002(pendingFile({ amount_atomic: '1000000' }), RESOURCE_URL))
  assert.ok(validatePendingCase002(pendingFile({ network: 'eip155:84532' }), RESOURCE_URL))
  assert.ok(validatePendingCase002(pendingFile({ asset: OTHER_ADDRESS }), RESOURCE_URL))
  assert.ok(validatePendingCase002(pendingFile({ recipient: OTHER_ADDRESS }), RESOURCE_URL))
  assert.ok(validatePendingCase002(pendingFile({ case: 'case-001' as never }), RESOURCE_URL))
  assert.ok(validatePendingCase002(pendingFile({ version: 2 as never }), RESOURCE_URL))
  assert.ok(validatePendingCase002(pendingFile({ payment_signature_header: '' }), RESOURCE_URL))
  assert.ok(validatePendingCase002(null, RESOURCE_URL))
})

test('a completed record can no longer authorize a payment', () => {
  // markCompleted writes a record without payment_signature_header; replaying it must fail.
  const completed = { version: 1, case: 'case-002', status: 'completed', resource_url: RESOURCE_URL }
  assert.ok(validatePendingCase002(completed, RESOURCE_URL))
})

// ---------------------------------------------------------------------------
// Evidence separation
// ---------------------------------------------------------------------------

test('the terminal summary is bounded and keeps the facts separate', () => {
  const body = 'x'.repeat(5000)
  const summary = summarizeCase002Delivery({
    httpStatus: 200,
    bodyText: body,
    contentType: 'application/json',
    transaction: '0x' + 'ee'.repeat(32),
    payer: WALLET,
    nonce: NONCE,
    bodySha256: 'a'.repeat(64),
    evidencePath: '/tmp/evidence.json',
  })
  assert.equal(summary.status, 'paid_and_delivered')
  assert.ok(summary.delivery.body_preview.length <= 600)
  assert.equal(summary.delivery.truncated, true)
  // Payment, delivery, correctness, judgment and public claims stay distinct.
  assert.match(summary.correctness, /NOT ASSESSED/)
  assert.match(summary.buyer_judgment, /NOT RECORDED/)
  assert.match(summary.public_claim, /NONE/)
  assert.equal(summary.payment.amount_atomic, '50000')
})

test('a non-200 paid response is reported as paid, not as a silent success', () => {
  const summary = summarizeCase002Delivery({
    httpStatus: 502,
    bodyText: 'bad gateway',
    contentType: 'text/plain',
    transaction: null,
    payer: WALLET,
    nonce: NONCE,
    bodySha256: 'b'.repeat(64),
    evidencePath: '/tmp/evidence.json',
  })
  assert.equal(summary.status, 'paid_response_not_ok')
})
