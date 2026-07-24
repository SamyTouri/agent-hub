import {
  buildPaymentRequirements,
  checkPaymentAgainstRequirements,
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
 * Case-001 is deliberately fixed in code. A changed endpoint, price, network,
 * asset or recipient is a new purchase decision, not a configurable retry.
 */
export const CASE001_PAYMENT = {
  endpoint:
    'https://transform-balanced-trunk-remedies.trycloudflare.com/v1/homepage-hero-order',
  paymentUrl: 'https://payanagent.com/x402/kh77taf99avt46753np9b0ktjn8azhsy',
  network: 'eip155:8453',
  asset: USDC_NETWORKS['eip155:8453'].usdc,
  recipient: '0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E',
  amountAtomic: '1000000',
  walletAccountName: 'agent-reputation-case-001-buyer',
} as const

export const CASE001_EXECUTION_SENTINEL =
  'I-AUTHORIZE-EXACTLY-1-USDC-FOR-AGENT-REPUTATION-CASE-001'

export const CASE001_WALLET_PREPARATION_SENTINEL =
  'I-AUTHORIZE-CDP-WALLET-PROVISIONING-FOR-AGENT-REPUTATION-CASE-001'

export type Case001OrderBody = {
  url: string
  primaryBuyer: string
  offer: string
  desiredAction: string
  replyTo: string
}

export function buildCase001OrderBody(deliveryContact: string): Case001OrderBody {
  const replyTo = deliveryContact.trim()
  if (replyTo.length < 5 || replyTo.length > 320) {
    throw new Error('CASE001_DELIVERY_CONTACT must contain a usable private delivery contact')
  }
  return {
    url: 'https://agentreputation.dev/',
    primaryBuyer:
      'Autonomous agents and their human operators who are deciding whether to buy a service from an AI agent.',
    offer:
      'Independent, source-linked evidence dossiers and manual pre-purchase decision analysis for a real contemplated AI-agent purchase. The service exposes facts, claims, contradictions, missing evidence and safeguards without turning them into a universal score or safety guarantee.',
    desiredAction:
      'Bring one real contemplated purchase to Agent Reputation for a manual pre-purchase review.',
    replyTo,
  }
}

export function case001AuthorizationErrors(input: {
  execute: boolean
  authorizeFlag: boolean
  env: Record<string, string | undefined>
}): string[] {
  const errors: string[] = []
  if (!input.execute) errors.push('missing --execute')
  if (!input.authorizeFlag) errors.push('missing --i-authorize-case-001-payment')
  if (input.env.CASE001_EXECUTE !== CASE001_EXECUTION_SENTINEL) {
    errors.push(`CASE001_EXECUTE must equal ${CASE001_EXECUTION_SENTINEL}`)
  }
  if (!input.env.CASE001_DELIVERY_CONTACT) errors.push('missing CASE001_DELIVERY_CONTACT')
  if (!input.env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!input.env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!input.env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

/**
 * Preparing the named CDP wallet is a separate external write. It cannot
 * transfer value, contact the seller or authorize a later payment.
 */
export function case001WalletPreparationErrors(env: Record<string, string | undefined>): string[] {
  const errors: string[] = []
  if (env.CASE001_WALLET_PREPARE !== CASE001_WALLET_PREPARATION_SENTINEL) {
    errors.push(`CASE001_WALLET_PREPARE must equal ${CASE001_WALLET_PREPARATION_SENTINEL}`)
  }
  if (!env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

/** Redundant SDK-level limits around the fixed Case-001 payment decision. */
export function buildCase001SpendControls() {
  return {
    maxAmountPerPayment: {
      atomic: BigInt(CASE001_PAYMENT.amountAtomic),
      asset: CASE001_PAYMENT.asset,
    },
    maxCumulativeSpend: {
      atomic: BigInt(CASE001_PAYMENT.amountAtomic),
      asset: CASE001_PAYMENT.asset,
    },
    maxCumulativeSpendWindow: '24h' as const,
    allowedNetworks: [CASE001_PAYMENT.network],
    allowedAssets: [CASE001_PAYMENT.asset],
    allowedPayees: [CASE001_PAYMENT.recipient],
    maxLedgerEntries: 5,
  }
}

export function evaluateCase001Challenge(paymentRequiredHeader: string | null) {
  const offers = normalizeChallenges({ paymentRequiredHeader })
  const evaluation = evaluateOffers(offers, {
    maxAmountAtomic: BigInt(CASE001_PAYMENT.amountAtomic),
    allowedNetworks: [CASE001_PAYMENT.network],
    expectedAsset: CASE001_PAYMENT.asset,
    expectedPayTo: CASE001_PAYMENT.recipient,
  })
  if (
    evaluation.decision !== 'GO' ||
    !evaluation.selected ||
    evaluation.selected.amountAtomic !== BigInt(CASE001_PAYMENT.amountAtomic)
  ) {
    return {
      ok: false as const,
      evaluation,
      reason:
        evaluation.decision !== 'GO'
          ? 'the observed x402 challenge does not match the documented Case-001 constraints'
          : 'the observed price is below the ceiling but is not exactly the authorized 1 USDC',
    }
  }
  return { ok: true as const, evaluation, offer: evaluation.selected }
}

/**
 * Final local validation of the SDK-produced payload before it can leave the
 * process. This is intentionally redundant with CDP spend controls.
 */
export function validateCase001PaymentPayload(payload: unknown) {
  const parsed = PaymentPayloadV2Schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false as const, reason: 'the CDP client produced an unreadable x402 v2 payload' }
  }
  const config: PrepurchaseConfig = {
    network: CASE001_PAYMENT.network,
    asset: CASE001_PAYMENT.asset,
    payTo: CASE001_PAYMENT.recipient,
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    facilitatorKind: 'cdp',
    mainnet: true,
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
