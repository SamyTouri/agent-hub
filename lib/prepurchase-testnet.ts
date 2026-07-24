import {
  buildPaymentRequirements,
  checkPaymentAgainstRequirements,
  type OrderInput,
  type PrepurchaseConfig,
} from './prepurchase.ts'
import {
  evaluateOffers,
  normalizeChallenges,
  PaymentPayloadV2Schema,
  USDC_NETWORKS,
  type PaymentPayloadV2,
} from './x402.ts'

/**
 * Fixed configuration for the funded Base Sepolia acceptance test.
 *
 * The receiver is intentionally not fixed here: it is a public address loaded
 * from the private runtime configuration. Every other payment dimension is
 * fixed so a changed challenge cannot silently widen the test.
 */
export const PREPURCHASE_TESTNET = {
  endpoint: 'http://127.0.0.1:3000/api/prepurchase/order',
  network: 'eip155:84532',
  asset: USDC_NETWORKS['eip155:84532'].usdc,
  amountAtomic: '1000000',
  buyerWalletAccountName: 'aghub-prepurchase-test-buyer',
  receiverWalletAccountName: 'aghub-prepurchase-test-receiver',
} as const

/**
 * The funded test may talk to the local route or to our own production route,
 * and to nothing else. This allowlist is defence in depth: the spendable
 * dimensions (network, asset, price, recipient) stay pinned by the challenge
 * evaluation and by the CDP spend controls, so a hostile or mistaken endpoint
 * still cannot widen what the buyer wallet is able to sign.
 */
export const PREPURCHASE_TESTNET_PRODUCTION_ENDPOINT =
  'https://agentreputation.dev/api/prepurchase/order'

export function resolvePrepurchaseTestnetEndpoint(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('PREPURCHASE_TESTNET_ENDPOINT is not a valid URL')
  }
  const local =
    parsed.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
  const production = parsed.protocol === 'https:' && parsed.hostname === 'agentreputation.dev'
  if (
    (!local && !production) ||
    parsed.pathname !== '/api/prepurchase/order' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error(
      'PREPURCHASE_TESTNET_ENDPOINT must be the local HTTP or the agentreputation.dev HTTPS pre-purchase route',
    )
  }
  return parsed.toString()
}

/**
 * Each faucet grant gets its own idempotency key, so a spent grant can be
 * replaced while a retry of the SAME grant still cannot mint a second one. The
 * hard ceiling keeps a broken loop from draining the shared testnet faucet.
 */
export const PREPURCHASE_TESTNET_MAX_FAUCET_GRANTS = 5

export function prepurchaseTestnetFaucetKey(previousGrants: number): string {
  if (!Number.isInteger(previousGrants) || previousGrants < 0) {
    throw new Error('previousGrants must be a non-negative integer')
  }
  if (previousGrants >= PREPURCHASE_TESTNET_MAX_FAUCET_GRANTS) {
    throw new Error(
      `REFUSED: ${PREPURCHASE_TESTNET_MAX_FAUCET_GRANTS} faucet grants already recorded; diagnose the test before requesting more`,
    )
  }
  return `aghub-prepurchase-base-sepolia-usdc-v${previousGrants + 1}`
}

export const PREPURCHASE_TESTNET_EXECUTION_SENTINEL =
  'I-AUTHORIZE-EXACTLY-1-TEST-USDC-ON-BASE-SEPOLIA'

export const PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL =
  'I-AUTHORIZE-CDP-TESTNET-WALLET-PROVISIONING'

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export function buildPrepurchaseTestnetOrder(): OrderInput {
  return {
    candidate: 'agent-reputation-testnet-fixture',
    mission: 'Validate the Agent Reputation x402 pre-purchase order flow end to end on Base Sepolia.',
    budget_exposure: 'Exactly 1 test USDC; no asset with monetary value and no mainnet authorization.',
    failure_consequence:
      'The test is inconclusive and must be diagnosed before any mainnet or seller-facing action.',
    public_constraints:
      'Base Sepolia only; fixed native test USDC contract; dedicated receiver; no public delivery.',
    delivery_contact: 'testnet-e2e@invalid.example',
  }
}

export function prepurchaseTestnetExecutionErrors(input: {
  execute: boolean
  env: Record<string, string | undefined>
}): string[] {
  const errors: string[] = []
  if (!input.execute) errors.push('missing --execute')
  if (input.env.PREPURCHASE_TESTNET_EXECUTE !== PREPURCHASE_TESTNET_EXECUTION_SENTINEL) {
    errors.push(`PREPURCHASE_TESTNET_EXECUTE must equal ${PREPURCHASE_TESTNET_EXECUTION_SENTINEL}`)
  }
  if (!EVM_ADDRESS_RE.test(input.env.PREPURCHASE_TESTNET_PAY_TO ?? '')) {
    errors.push('PREPURCHASE_TESTNET_PAY_TO must be a valid dedicated EVM receiver')
  }
  if (!input.env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!input.env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!input.env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

export function prepurchaseTestnetWalletPreparationErrors(
  env: Record<string, string | undefined>,
): string[] {
  const errors: string[] = []
  if (
    env.PREPURCHASE_TESTNET_WALLET_PREPARE !==
    PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL
  ) {
    errors.push(
      `PREPURCHASE_TESTNET_WALLET_PREPARE must equal ${PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL}`,
    )
  }
  if (!env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

export function evaluatePrepurchaseTestnetChallenge(
  paymentRequiredHeader: string | null,
  expectedPayTo: string,
) {
  const evaluation = evaluateOffers(normalizeChallenges({ paymentRequiredHeader }), {
    maxAmountAtomic: BigInt(PREPURCHASE_TESTNET.amountAtomic),
    allowedNetworks: [PREPURCHASE_TESTNET.network],
    expectedAsset: PREPURCHASE_TESTNET.asset,
    expectedPayTo,
  })
  if (
    evaluation.decision !== 'GO' ||
    !evaluation.selected ||
    evaluation.selected.amountAtomic !== BigInt(PREPURCHASE_TESTNET.amountAtomic)
  ) {
    return {
      ok: false as const,
      evaluation,
      reason:
        evaluation.decision !== 'GO'
          ? 'the x402 challenge does not match the fixed Base Sepolia test'
          : 'the price is below the ceiling but is not exactly 1 test USDC',
    }
  }
  return { ok: true as const, evaluation, offer: evaluation.selected }
}

export function buildPrepurchaseTestnetSpendControls(payTo: string) {
  if (!EVM_ADDRESS_RE.test(payTo)) throw new Error('invalid testnet receiver address')
  return {
    maxAmountPerPayment: {
      atomic: BigInt(PREPURCHASE_TESTNET.amountAtomic),
      asset: PREPURCHASE_TESTNET.asset,
    },
    maxCumulativeSpend: {
      atomic: BigInt(PREPURCHASE_TESTNET.amountAtomic),
      asset: PREPURCHASE_TESTNET.asset,
    },
    maxCumulativeSpendWindow: '24h' as const,
    allowedNetworks: [PREPURCHASE_TESTNET.network],
    allowedAssets: [PREPURCHASE_TESTNET.asset],
    allowedPayees: [payTo],
    maxLedgerEntries: 5,
  }
}

export function validatePrepurchaseTestnetPaymentPayload(payload: unknown, payTo: string) {
  const parsed = PaymentPayloadV2Schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false as const, reason: 'the CDP client produced an unreadable x402 v2 payload' }
  }
  const config: PrepurchaseConfig = {
    network: PREPURCHASE_TESTNET.network,
    asset: PREPURCHASE_TESTNET.asset,
    payTo,
    facilitatorUrl: 'https://x402.org/facilitator',
    facilitatorKind: 'public',
    mainnet: false,
  }
  const check = checkPaymentAgainstRequirements(
    parsed.data as PaymentPayloadV2,
    buildPaymentRequirements(config),
  )
  if (!check.ok) return { ok: false as const, reason: check.reason }
  return {
    ok: true as const,
    payload: parsed.data as PaymentPayloadV2,
    nonce: check.nonce,
    payer: check.payer,
  }
}
