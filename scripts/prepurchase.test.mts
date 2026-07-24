import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http'

import {
  buildCase001OrderBody,
  buildCase001SpendControls,
  CASE001_EXECUTION_SENTINEL,
  CASE001_PAYMENT,
  CASE001_WALLET_PREPARATION_SENTINEL,
  case001AuthorizationErrors,
  case001WalletPreparationErrors,
  evaluateCase001Challenge,
  validateCase001PaymentPayload,
} from '../lib/case001-payment.ts'
import {
  buildPaymentRequired,
  buildPaymentRequirements,
  checkPaymentAgainstRequirements,
  deriveOrderId,
  MAINNET_ACK_VALUE,
  orderReceipt,
  OrderInputSchema,
  parsePrepurchaseConfig,
  PREPURCHASE_PRICE_ATOMIC,
  processPaidOrder,
  type OrderInput,
  type PaidOrderDeps,
  type PrepurchaseConfig,
  type StoredOrder,
} from '../lib/prepurchase.ts'
import {
  buildPrepurchaseTestnetOrder,
  buildPrepurchaseTestnetSpendControls,
  evaluatePrepurchaseTestnetChallenge,
  PREPURCHASE_TESTNET,
  PREPURCHASE_TESTNET_EXECUTION_SENTINEL,
  PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL,
  prepurchaseTestnetExecutionErrors,
  prepurchaseTestnetWalletPreparationErrors,
  validatePrepurchaseTestnetPaymentPayload,
} from '../lib/prepurchase-testnet.ts'
import {
  decodeBase64Json,
  encodeBase64Json,
  evaluateOffers,
  normalizeChallenges,
  PaymentPayloadV2Schema,
  USDC_NETWORKS,
  type PaymentPayloadV2,
} from '../lib/x402.ts'

const PAY_TO = '0x1111111111111111111111111111111111111111'
const PAYER = '0x2222222222222222222222222222222222222222'
const NONCE = '0x' + 'ab'.repeat(32)

const testnetEnv = { PREPURCHASE_ENABLED: 'true', PREPURCHASE_PAY_TO: PAY_TO }

function testnetConfig(): PrepurchaseConfig {
  const parsed = parsePrepurchaseConfig(testnetEnv)
  assert.ok(parsed.ok)
  return parsed.config
}

function validPayload(config: PrepurchaseConfig, overrides?: {
  accepted?: Partial<PaymentPayloadV2['accepted']>
  authorization?: Partial<PaymentPayloadV2['payload']['authorization']>
}): PaymentPayloadV2 {
  const accepted = { ...buildPaymentRequirements(config), ...overrides?.accepted }
  return {
    x402Version: 2,
    accepted,
    payload: {
      signature: '0x' + 'cd'.repeat(65),
      authorization: {
        from: PAYER,
        to: config.payTo,
        value: accepted.amount,
        validAfter: '0',
        validBefore: '9999999999',
        nonce: NONCE,
        ...overrides?.authorization,
      },
    },
  } as PaymentPayloadV2
}

const orderInput: OrderInput = {
  candidate: 'homepage-rewrite-agent-base-usdc',
  mission: 'Draft three homepage hero options for our public site.',
  budget_exposure: '1 USDC, no credentials',
  failure_consequence: 'Lost 1 USDC and a wasted day of iteration.',
  delivery_contact: 'buyer@example.invalid',
}

/** Deps mockées : tout réussit ; chaque étape enregistre son passage. */
function makeDeps(overrides?: Partial<PaidOrderDeps> & { capReached?: boolean }) {
  const calls: string[] = []
  const inserted: StoredOrder[] = []
  const deps: PaidOrderDeps = {
    findOrderByNonce: async () => {
      calls.push('find')
      return null
    },
    verify: async () => {
      calls.push('verify')
      return { isValid: true, payer: PAYER }
    },
    reserve: async () => {
      calls.push('reserve')
      return overrides?.capReached ? { status: 'cap_reached' } : { status: 'reserved' }
    },
    settle: async () => {
      calls.push('settle')
      return { success: true, payer: PAYER, transaction: '0x' + 'ee'.repeat(32), network: 'eip155:84532' }
    },
    finalize: async (order) => {
      calls.push('finalize')
      inserted.push(order)
      return order
    },
    now: () => new Date('2026-07-23T12:00:00.000Z'),
    ...overrides,
  }
  return { deps, calls, inserted }
}

// ---------------------------------------------------------------------------
// Config fail-closed
// ---------------------------------------------------------------------------

test('offer is inactive unless PREPURCHASE_ENABLED is exactly "true"', () => {
  assert.equal(parsePrepurchaseConfig({}).ok, false)
  assert.equal(parsePrepurchaseConfig({ PREPURCHASE_ENABLED: 'TRUE', PREPURCHASE_PAY_TO: PAY_TO }).ok, false)
  assert.equal(parsePrepurchaseConfig({ PREPURCHASE_ENABLED: '1', PREPURCHASE_PAY_TO: PAY_TO }).ok, false)
})

test('testnet is the default network with the public testnet facilitator', () => {
  const parsed = parsePrepurchaseConfig(testnetEnv)
  assert.ok(parsed.ok)
  assert.equal(parsed.config.network, 'eip155:84532')
  assert.equal(parsed.config.mainnet, false)
  assert.equal(parsed.config.asset, USDC_NETWORKS['eip155:84532'].usdc)
  assert.equal(parsed.config.facilitatorUrl, 'https://x402.org/facilitator')
})

test('a missing or malformed receiving address disables the offer', () => {
  assert.equal(parsePrepurchaseConfig({ PREPURCHASE_ENABLED: 'true' }).ok, false)
  assert.equal(parsePrepurchaseConfig({ PREPURCHASE_ENABLED: 'true', PREPURCHASE_PAY_TO: 'not-an-address' }).ok, false)
  assert.equal(parsePrepurchaseConfig({ PREPURCHASE_ENABLED: 'true', PREPURCHASE_PAY_TO: PAY_TO.slice(0, 41) }).ok, false)
})

test('unknown networks and non-https facilitators are refused', () => {
  assert.equal(parsePrepurchaseConfig({ ...testnetEnv, PREPURCHASE_NETWORK: 'eip155:1' }).ok, false)
  assert.equal(parsePrepurchaseConfig({ ...testnetEnv, PREPURCHASE_NETWORK: 'base-sepolia' }).ok, false)
  assert.equal(
    parsePrepurchaseConfig({ ...testnetEnv, PREPURCHASE_FACILITATOR_URL: 'http://insecure.example' }).ok,
    false,
  )
})

test('mainnet requires the explicit ack and authenticated CDP facilitator credentials', () => {
  const base = { ...testnetEnv, PREPURCHASE_NETWORK: 'eip155:8453' }
  assert.equal(parsePrepurchaseConfig(base).ok, false)
  assert.equal(parsePrepurchaseConfig({ ...base, PREPURCHASE_MAINNET_ACK: 'yes' }).ok, false)
  assert.equal(parsePrepurchaseConfig({ ...base, PREPURCHASE_MAINNET_ACK: MAINNET_ACK_VALUE }).ok, false)
  const wrongFacilitator = parsePrepurchaseConfig({
    ...base,
    PREPURCHASE_MAINNET_ACK: MAINNET_ACK_VALUE,
    PREPURCHASE_FACILITATOR_URL: 'https://facilitator.example',
    CDP_API_KEY_ID: 'test-id',
    CDP_API_KEY_SECRET: 'test-secret',
  })
  assert.equal(wrongFacilitator.ok, false)

  const full = parsePrepurchaseConfig({
    ...base,
    PREPURCHASE_MAINNET_ACK: MAINNET_ACK_VALUE,
    CDP_API_KEY_ID: 'test-id',
    CDP_API_KEY_SECRET: 'test-secret',
  })
  assert.ok(full.ok)
  assert.equal(full.config.mainnet, true)
  assert.equal(full.config.facilitatorKind, 'cdp')
  assert.equal(full.config.facilitatorUrl, 'https://api.cdp.coinbase.com/platform/v2/x402')
  assert.equal(full.config.asset, USDC_NETWORKS['eip155:8453'].usdc)
})

test('mainnet is never inferred from a production environment', () => {
  const parsed = parsePrepurchaseConfig({
    ...testnetEnv,
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
  })
  assert.ok(parsed.ok)
  assert.equal(parsed.config.network, 'eip155:84532')
})

// ---------------------------------------------------------------------------
// Challenge et intake
// ---------------------------------------------------------------------------

test('the challenge advertises exactly 1 USDC, exact scheme and eip3009 metadata', () => {
  const required = buildPaymentRequired(testnetConfig())
  assert.equal(required.x402Version, 2)
  assert.equal(required.accepts.length, 1)
  const offer = required.accepts[0]
  assert.equal(offer.scheme, 'exact')
  assert.equal(offer.amount, '1000000')
  assert.equal(offer.network, 'eip155:84532')
  assert.equal(offer.payTo, PAY_TO)
  assert.equal(offer.extra?.assetTransferMethod, 'eip3009')
})

test('order intake enforces the strict input schema', () => {
  assert.ok(OrderInputSchema.safeParse(orderInput).success)
  assert.equal(OrderInputSchema.safeParse({ ...orderInput, mission: 'too short' }).success, false)
  assert.equal(OrderInputSchema.safeParse({ ...orderInput, delivery_contact: '' }).success, false)
  const { candidate: _dropped, ...missingCandidate } = orderInput
  assert.equal(OrderInputSchema.safeParse(missingCandidate).success, false)
})

test('base64 payment headers round-trip and reject garbage', () => {
  const config = testnetConfig()
  const payload = validPayload(config)
  const decoded = decodeBase64Json(encodeBase64Json(payload))
  assert.ok(PaymentPayloadV2Schema.safeParse(decoded).success)
  assert.equal(decodeBase64Json('not base64 json !!'), null)
  assert.equal(decodeBase64Json(''), null)
  assert.equal(decodeBase64Json('x'.repeat(20_000)), null)
})

test('local header encoding is byte-compatible with the official x402 v2 codec', () => {
  const config = testnetConfig()
  const required = buildPaymentRequired(config)
  const payload = validPayload(config)

  assert.equal(encodeBase64Json(required), encodePaymentRequiredHeader(required))
  assert.deepEqual(decodePaymentRequiredHeader(encodeBase64Json(required)), required)
  assert.equal(encodeBase64Json(payload), encodePaymentSignatureHeader(payload))
  assert.deepEqual(decodePaymentSignatureHeader(encodeBase64Json(payload)), payload)
})

// ---------------------------------------------------------------------------
// Validation du paiement contre l'offre
// ---------------------------------------------------------------------------

test('a payment matching the offer is accepted and yields nonce + payer', () => {
  const config = testnetConfig()
  const check = checkPaymentAgainstRequirements(validPayload(config), buildPaymentRequirements(config))
  assert.ok(check.ok)
  assert.equal(check.nonce, NONCE.toLowerCase())
  assert.equal(check.payer, PAYER)
})

test('tampered amount, network, recipient or authorization are refused', () => {
  const config = testnetConfig()
  const required = buildPaymentRequirements(config)
  const cases: Array<[string, PaymentPayloadV2]> = [
    ['amount', validPayload(config, { accepted: { amount: '1' }, authorization: { value: '1' } })],
    ['network', validPayload(config, { accepted: { network: 'eip155:8453' } })],
    ['payTo', validPayload(config, { accepted: { payTo: PAYER } })],
    ['asset', validPayload(config, { accepted: { asset: PAYER } })],
    ['authorization.to', validPayload(config, { authorization: { to: PAYER } })],
    ['authorization.value', validPayload(config, { authorization: { value: '999999' } })],
  ]
  for (const [label, payload] of cases) {
    assert.equal(checkPaymentAgainstRequirements(payload, required).ok, false, `${label} should be refused`)
  }
})

test('order ids are stable per nonce and distinct across nonces/networks', () => {
  const a = deriveOrderId('eip155:84532', NONCE)
  assert.equal(a, deriveOrderId('eip155:84532', NONCE.toUpperCase().replace('0X', '0x')))
  assert.match(a, /^apo_[0-9a-f]{20}$/)
  assert.notEqual(a, deriveOrderId('eip155:8453', NONCE))
  assert.notEqual(a, deriveOrderId('eip155:84532', '0x' + 'ff'.repeat(32)))
})

// ---------------------------------------------------------------------------
// Orchestration payée
// ---------------------------------------------------------------------------

test('happy path: verify, settle, then record the order with deadline and cutoff', async () => {
  const config = testnetConfig()
  const { deps, calls, inserted } = makeDeps()
  const result = await processPaidOrder(deps, config, orderInput, validPayload(config))
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, ['find', 'verify', 'reserve', 'settle', 'finalize'])
  assert.ok(result.status === 'ok')
  assert.equal(result.replay, false)
  assert.equal(result.order.id, deriveOrderId(config.network, NONCE))
  assert.equal(result.order.amountAtomic, PREPURCHASE_PRICE_ATOMIC)
  assert.equal(result.order.settledAt, '2026-07-23T12:00:00.000Z')
  assert.equal(result.order.evidenceCutoff, '2026-07-23T12:00:00.000Z')
  assert.equal(result.order.deliveryDeadline, '2026-07-24T12:00:00.000Z')
  assert.equal(inserted.length, 1)
})

test('a replayed settled payment returns the same order without paying twice', async () => {
  const config = testnetConfig()
  const existing = { id: 'apo_existing' } as StoredOrder
  const { deps, calls } = makeDeps({
    findOrderByNonce: async () => existing,
  })
  const result = await processPaidOrder(deps, config, orderInput, validPayload(config))
  assert.ok(result.status === 'ok')
  assert.equal(result.replay, true)
  assert.equal(result.order.id, 'apo_existing')
  // Ni verify, ni réservation, ni settle : aucune nouvelle dépense possible.
  assert.deepEqual(calls, [])
})

test('an invalid payment stops before any network or database effect', async () => {
  const config = testnetConfig()
  const { deps, calls } = makeDeps()
  const tampered = validPayload(config, { accepted: { network: 'eip155:8453' } })
  const result = await processPaidOrder(deps, config, orderInput, tampered)
  assert.equal(result.status, 'invalid_payment')
  assert.deepEqual(calls, [])
})

test('facilitator rejection stops before settlement', async () => {
  const config = testnetConfig()
  const { deps, calls } = makeDeps({
    verify: async () => ({ isValid: false, invalidReason: 'insufficient balance' }),
  })
  const result = await processPaidOrder(deps, config, orderInput, validPayload(config))
  assert.equal(result.status, 'verify_failed')
  assert.ok(result.status === 'verify_failed' && result.reason.includes('insufficient'))
  assert.ok(!calls.includes('reserve') && !calls.includes('settle') && !calls.includes('finalize'))
})

test('settlement failure creates no order but recovers an order settled earlier', async () => {
  const config = testnetConfig()
  const failed = await processPaidOrder(
    makeDeps({ settle: async () => ({ success: false, errorReason: 'authorization expired' }) }).deps,
    config,
    orderInput,
    validPayload(config),
  )
  assert.equal(failed.status, 'settle_failed')

  // Cas de récupération : settle "échoue" (nonce déjà consommé) mais la commande
  // existe déjà en base — l'acheteur retrouve sa commande, rien n'est recréé.
  let findCalls = 0
  const existing = { id: 'apo_recovered' } as StoredOrder
  const recovered = await processPaidOrder(
    makeDeps({
      findOrderByNonce: async () => (findCalls++ === 0 ? null : existing),
      settle: async () => ({ success: false, errorReason: 'nonce already used' }),
    }).deps,
    config,
    orderInput,
    validPayload(config),
  )
  assert.ok(recovered.status === 'ok' && recovered.order.id === 'apo_recovered' && recovered.replay)
})

test('the atomic capacity reservation closes the offer before settlement, never after', async () => {
  const config = testnetConfig()
  const atBoundary = await processPaidOrder(makeDeps().deps, config, orderInput, validPayload(config))
  assert.equal(atBoundary.status, 'ok')

  // Le facilitator vérifie d'abord la signature ; la réservation DB atomique
  // ferme ensuite la capacité avant tout règlement.
  const { deps, calls } = makeDeps({ capReached: true })
  const overCap = await processPaidOrder(deps, config, orderInput, validPayload(config))
  assert.equal(overCap.status, 'cap_reached')
  assert.deepEqual(calls, ['find', 'verify', 'reserve'])
  assert.ok(!calls.includes('settle') && !calls.includes('finalize'))
})

test('a replay is still honored after the cap is reached', async () => {
  const config = testnetConfig()
  const existing = { id: 'apo_precap' } as StoredOrder
  const result = await processPaidOrder(
    makeDeps({ capReached: true, findOrderByNonce: async () => existing }).deps,
    config,
    orderInput,
    validPayload(config),
  )
  assert.ok(result.status === 'ok' && result.order.id === 'apo_precap')
})

test('a reused payment nonce cannot change the reserved order body', async () => {
  const config = testnetConfig()
  const { deps, calls } = makeDeps({
    reserve: async () => ({ status: 'input_conflict' }),
  })
  const result = await processPaidOrder(deps, config, orderInput, validPayload(config))
  assert.equal(result.status, 'input_conflict')
  assert.ok(!calls.includes('settle') && !calls.includes('finalize'))
})

test('the public receipt never contains the private delivery contact', async () => {
  const config = testnetConfig()
  const { deps } = makeDeps()
  const result = await processPaidOrder(deps, config, orderInput, validPayload(config))
  assert.ok(result.status === 'ok')
  const receipt = orderReceipt(result.order, result.settlement)
  assert.ok(!JSON.stringify(receipt).includes(orderInput.delivery_contact))
  assert.equal(receipt.order_id, result.order.id)
  assert.equal(receipt.payment.amount_atomic, '1000000')
  assert.ok(receipt.delivery.deadline > receipt.evidence_cutoff)
})

// ---------------------------------------------------------------------------
// Côté acheteur : normalisation et évaluation d'offres observées
// ---------------------------------------------------------------------------

const SELLER_PAY_TO = '0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E'
const BASE_USDC = USDC_NETWORKS['eip155:8453'].usdc

test('v1 body challenges and v2 header challenges normalize to the same shape', () => {
  const v1 = normalizeChallenges({
    body: {
      x402Version: 1,
      accepts: [
        { scheme: 'exact', network: 'base', maxAmountRequired: '1000000', asset: BASE_USDC, payTo: SELLER_PAY_TO },
      ],
    },
  })
  assert.equal(v1.length, 1)
  assert.equal(v1[0].network, 'eip155:8453')
  assert.equal(v1[0].amountAtomic, 1_000_000n)

  const v2 = normalizeChallenges({
    paymentRequiredHeader: encodeBase64Json({
      x402Version: 2,
      resource: { url: 'https://seller.example/order' },
      accepts: [
        { scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: BASE_USDC, payTo: SELLER_PAY_TO, maxTimeoutSeconds: 600 },
      ],
    }),
  })
  assert.equal(v2.length, 1)
  assert.equal(v2[0].network, 'eip155:8453')
  assert.equal(v2[0].amountAtomic, 1_000_000n)
})

test('offer evaluation is GO only when every expectation holds', () => {
  const good = normalizeChallenges({
    body: { x402Version: 2, accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: BASE_USDC, payTo: SELLER_PAY_TO }] },
  })
  const expectations = {
    maxAmountAtomic: 1_000_000n,
    allowedNetworks: ['eip155:8453'],
    expectedPayTo: SELLER_PAY_TO,
  }
  assert.equal(evaluateOffers(good, expectations).decision, 'GO')

  const overpriced = structuredClone(good)
  overpriced[0].amountAtomic = 2_000_000n
  assert.equal(evaluateOffers(overpriced, expectations).decision, 'NO-GO')

  const wrongNetwork = structuredClone(good)
  wrongNetwork[0].network = 'eip155:1'
  assert.equal(evaluateOffers(wrongNetwork, expectations).decision, 'NO-GO')

  const wrongRecipient = structuredClone(good)
  wrongRecipient[0].payTo = PAY_TO
  assert.equal(evaluateOffers(wrongRecipient, expectations).decision, 'NO-GO')

  const wrongAsset = structuredClone(good)
  wrongAsset[0].asset = PAY_TO
  assert.equal(evaluateOffers(wrongAsset, expectations).decision, 'NO-GO')

  assert.equal(evaluateOffers([], expectations).decision, 'NO-GO')
})

// ---------------------------------------------------------------------------
// Case-001 executable buyer guardrails
// ---------------------------------------------------------------------------

test('Case-001 execution requires two explicit approvals, private contact and all CDP secrets', () => {
  const empty = case001AuthorizationErrors({
    execute: false,
    authorizeFlag: false,
    env: {},
  })
  assert.equal(empty.length, 7)

  const authorized = case001AuthorizationErrors({
    execute: true,
    authorizeFlag: true,
    env: {
      CASE001_EXECUTE: CASE001_EXECUTION_SENTINEL,
      CASE001_DELIVERY_CONTACT: 'buyer@example.invalid',
      CDP_API_KEY_ID: 'test-id',
      CDP_API_KEY_SECRET: 'test-secret',
      CDP_WALLET_SECRET: 'test-wallet-secret',
    },
  })
  assert.deepEqual(authorized, [])
})

test('Case-001 wallet preparation is separately gated and cannot imply payment authorization', () => {
  assert.equal(case001WalletPreparationErrors({}).length, 4)
  assert.deepEqual(
    case001WalletPreparationErrors({
      CASE001_WALLET_PREPARE: CASE001_WALLET_PREPARATION_SENTINEL,
      CDP_API_KEY_ID: 'test-id',
      CDP_API_KEY_SECRET: 'test-secret',
      CDP_WALLET_SECRET: 'test-wallet-secret',
    }),
    [],
  )

  const controls = buildCase001SpendControls()
  assert.equal(controls.maxAmountPerPayment.atomic, 1_000_000n)
  assert.equal(controls.maxCumulativeSpend.atomic, 1_000_000n)
  assert.deepEqual(controls.allowedNetworks, ['eip155:8453'])
  assert.deepEqual(controls.allowedAssets, [CASE001_PAYMENT.asset])
  assert.deepEqual(controls.allowedPayees, [CASE001_PAYMENT.recipient])
})

test('Case-001 order body keeps the private contact only in the execution-time body', () => {
  const body = buildCase001OrderBody(' buyer@example.invalid ')
  assert.equal(body.replyTo, 'buyer@example.invalid')
  assert.equal(body.url, 'https://agentreputation.dev/')
  assert.throws(() => buildCase001OrderBody(''))
})

test('Case-001 challenge must be exactly 1 USDC on Base to the documented recipient', () => {
  const challenge = {
    x402Version: 2,
    resource: { url: CASE001_PAYMENT.endpoint },
    accepts: [
      {
        scheme: 'exact',
        network: CASE001_PAYMENT.network,
        amount: CASE001_PAYMENT.amountAtomic,
        asset: CASE001_PAYMENT.asset,
        payTo: CASE001_PAYMENT.recipient,
        maxTimeoutSeconds: 60,
      },
    ],
  }
  assert.equal(evaluateCase001Challenge(encodeBase64Json(challenge)).ok, true)
  assert.equal(
    evaluateCase001Challenge(
      encodeBase64Json({
        ...challenge,
        accepts: [{ ...challenge.accepts[0], amount: '1000001' }],
      }),
    ).ok,
    false,
  )
  assert.equal(
    evaluateCase001Challenge(
      encodeBase64Json({
        ...challenge,
        accepts: [{ ...challenge.accepts[0], payTo: PAYER }],
      }),
    ).ok,
    false,
  )
})

test('Case-001 validates the final SDK payload again before network submission', () => {
  const payload = {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: CASE001_PAYMENT.network,
      amount: CASE001_PAYMENT.amountAtomic,
      asset: CASE001_PAYMENT.asset,
      payTo: CASE001_PAYMENT.recipient,
      maxTimeoutSeconds: 60,
    },
    payload: {
      signature: '0x' + 'cd'.repeat(65),
      authorization: {
        from: PAYER,
        to: CASE001_PAYMENT.recipient,
        value: CASE001_PAYMENT.amountAtomic,
        validAfter: '0',
        validBefore: '9999999999',
        nonce: NONCE,
      },
    },
  }
  assert.equal(validateCase001PaymentPayload(payload).ok, true)
  assert.equal(
    validateCase001PaymentPayload({
      ...payload,
      payload: {
        ...payload.payload,
        authorization: { ...payload.payload.authorization, value: '1000001' },
      },
    }).ok,
    false,
  )
})

// ---------------------------------------------------------------------------
// Funded Base Sepolia acceptance-test guardrails
// ---------------------------------------------------------------------------

test('testnet execution requires the exact sentinel, receiver and CDP credentials', () => {
  assert.equal(
    prepurchaseTestnetExecutionErrors({
      execute: false,
      env: {},
    }).length,
    6,
  )
  assert.deepEqual(
    prepurchaseTestnetExecutionErrors({
      execute: true,
      env: {
        PREPURCHASE_TESTNET_EXECUTE: PREPURCHASE_TESTNET_EXECUTION_SENTINEL,
        PREPURCHASE_TESTNET_PAY_TO: PAY_TO,
        CDP_API_KEY_ID: 'test-id',
        CDP_API_KEY_SECRET: 'test-secret',
        CDP_WALLET_SECRET: 'test-wallet-secret',
      },
    }),
    [],
  )
})

test('testnet wallet preparation is a separate non-payment gate', () => {
  assert.equal(prepurchaseTestnetWalletPreparationErrors({}).length, 4)
  assert.deepEqual(
    prepurchaseTestnetWalletPreparationErrors({
      PREPURCHASE_TESTNET_WALLET_PREPARE: PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL,
      CDP_API_KEY_ID: 'test-id',
      CDP_API_KEY_SECRET: 'test-secret',
      CDP_WALLET_SECRET: 'test-wallet-secret',
    }),
    [],
  )
})

test('testnet challenge, spend controls and signed payload stay fixed to Base Sepolia', () => {
  const challenge = {
    x402Version: 2,
    resource: { url: PREPURCHASE_TESTNET.endpoint },
    accepts: [
      {
        scheme: 'exact',
        network: PREPURCHASE_TESTNET.network,
        amount: PREPURCHASE_TESTNET.amountAtomic,
        asset: PREPURCHASE_TESTNET.asset,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
      },
    ],
  }
  assert.equal(
    evaluatePrepurchaseTestnetChallenge(encodeBase64Json(challenge), PAY_TO).ok,
    true,
  )
  assert.equal(
    evaluatePrepurchaseTestnetChallenge(
      encodeBase64Json({
        ...challenge,
        accepts: [{ ...challenge.accepts[0], network: 'eip155:8453' }],
      }),
      PAY_TO,
    ).ok,
    false,
  )

  const controls = buildPrepurchaseTestnetSpendControls(PAY_TO)
  assert.equal(controls.maxAmountPerPayment.atomic, 1_000_000n)
  assert.equal(controls.maxCumulativeSpend.atomic, 1_000_000n)
  assert.deepEqual(controls.allowedNetworks, ['eip155:84532'])
  assert.deepEqual(controls.allowedAssets, [PREPURCHASE_TESTNET.asset])
  assert.deepEqual(controls.allowedPayees, [PAY_TO])

  const payload = {
    x402Version: 2,
    accepted: challenge.accepts[0],
    payload: {
      signature: '0x' + 'cd'.repeat(65),
      authorization: {
        from: PAYER,
        to: PAY_TO,
        value: PREPURCHASE_TESTNET.amountAtomic,
        validAfter: '0',
        validBefore: '9999999999',
        nonce: NONCE,
      },
    },
  }
  assert.equal(validatePrepurchaseTestnetPaymentPayload(payload, PAY_TO).ok, true)
  assert.equal(
    validatePrepurchaseTestnetPaymentPayload(
      {
        ...payload,
        accepted: { ...payload.accepted, amount: '1000001' },
      },
      PAY_TO,
    ).ok,
    false,
  )
})

test('testnet order uses a non-deliverable fixture contact and no private data', () => {
  const body = buildPrepurchaseTestnetOrder()
  assert.equal(body.delivery_contact, 'testnet-e2e@invalid.example')
  assert.equal(body.budget_exposure.includes('test USDC'), true)
  assert.equal(body.failure_consequence.includes('mainnet'), true)
})
