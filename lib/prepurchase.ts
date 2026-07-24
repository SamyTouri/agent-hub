import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  EVM_ADDRESS_RE,
  sameAddress,
  USDC_NETWORKS,
  type PaymentPayloadV2,
  type PaymentRequiredV2,
  type PaymentRequirementsV2,
  type SettleResponse,
  type UsdcNetworkId,
  type VerifyResponse,
} from './x402.ts'

// Domaine du premier produit payant : un brief de preuve préachat manuel à
// périmètre fixe, payé en x402 `exact` (USDC). Tout ici est pur et testable
// sans réseau, sans secret et sans DB — la route injecte les effets.
//
// Séparation des faits (règle produit) : le paiement réglé, la livraison et le
// résultat côté acheteur sont trois faits distincts, jamais fusionnés. Payer
// n'achète JAMAIS une note, un classement ou un verdict favorable.

/** Prix fixe de l'offre pilote : 1 USDC (6 décimales). Constante, non modifiable via l'env. */
export const PREPURCHASE_PRICE_ATOMIC = '1000000'
/** Borne expérimentale de revenu brut : 100 USDC, ensuite l'offre se ferme. */
export const PREPURCHASE_REVENUE_CAP_ATOMIC = 100_000_000n
/** Délai de livraison promis (analyse manuelle). */
export const PREPURCHASE_DELIVERY_HOURS = 24
/** Fenêtre de validité de l'autorisation de paiement. */
export const PREPURCHASE_MAX_TIMEOUT_SECONDS = 600

export const PREPURCHASE_RESOURCE_URL = 'https://agentreputation.dev/api/prepurchase/order'

/**
 * Le mainnet ne peut JAMAIS être déduit d'un environnement de production : il
 * exige cette valeur exacte dans PREPURCHASE_MAINNET_ACK, en plus du réseau.
 */
export const MAINNET_ACK_VALUE = 'I-UNDERSTAND-THIS-ACCEPTS-REAL-USDC-ON-BASE-MAINNET'

const TESTNET_FACILITATOR_URL = 'https://x402.org/facilitator'
export const CDP_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402'

export type PrepurchaseConfig = {
  network: UsdcNetworkId
  asset: string
  payTo: string
  facilitatorUrl: string
  facilitatorKind: 'public' | 'cdp'
  mainnet: boolean
}

export type ConfigResult = { ok: true; config: PrepurchaseConfig } | { ok: false; reason: string }

/**
 * Config fail-closed, lue à la requête (jamais au chargement du module, pour que
 * `next build` n'exige aucun secret). Toute incohérence => offre inactive.
 */
export function parsePrepurchaseConfig(env: Record<string, string | undefined>): ConfigResult {
  if (env.PREPURCHASE_ENABLED !== 'true') {
    return { ok: false, reason: 'PREPURCHASE_ENABLED is not "true"' }
  }
  const payTo = env.PREPURCHASE_PAY_TO ?? ''
  if (!EVM_ADDRESS_RE.test(payTo)) {
    return { ok: false, reason: 'PREPURCHASE_PAY_TO is missing or not a valid 0x address' }
  }
  const network = (env.PREPURCHASE_NETWORK ?? 'eip155:84532') as UsdcNetworkId
  const known = USDC_NETWORKS[network]
  if (!known) {
    return { ok: false, reason: `PREPURCHASE_NETWORK "${env.PREPURCHASE_NETWORK}" is not supported` }
  }

  const facilitatorOverride = env.PREPURCHASE_FACILITATOR_URL
  if (facilitatorOverride && !/^https:\/\//.test(facilitatorOverride)) {
    return { ok: false, reason: 'PREPURCHASE_FACILITATOR_URL must be https' }
  }

  if (known.mainnet) {
    if (env.PREPURCHASE_MAINNET_ACK !== MAINNET_ACK_VALUE) {
      return { ok: false, reason: 'mainnet requires the explicit PREPURCHASE_MAINNET_ACK sentence' }
    }
    if (facilitatorOverride && facilitatorOverride.replace(/\/+$/, '') !== CDP_FACILITATOR_URL) {
      return { ok: false, reason: 'mainnet only supports the authenticated CDP facilitator' }
    }
    if (!env.CDP_API_KEY_ID || !env.CDP_API_KEY_SECRET) {
      return {
        ok: false,
        reason: 'mainnet requires CDP_API_KEY_ID and CDP_API_KEY_SECRET',
      }
    }
  }

  const facilitatorUrl = (
    known.mainnet ? CDP_FACILITATOR_URL : facilitatorOverride ?? TESTNET_FACILITATOR_URL
  ).replace(/\/+$/, '')
  const facilitatorKind = facilitatorUrl === CDP_FACILITATOR_URL ? 'cdp' : 'public'
  if (facilitatorKind === 'cdp' && (!env.CDP_API_KEY_ID || !env.CDP_API_KEY_SECRET)) {
    return { ok: false, reason: 'the CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET' }
  }

  return {
    ok: true,
    config: {
      network,
      asset: known.usdc,
      payTo,
      facilitatorUrl,
      facilitatorKind,
      mainnet: known.mainnet,
    },
  }
}

// ---------------------------------------------------------------------------
// Intake : schéma strict de la commande
// ---------------------------------------------------------------------------

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max)

export const OrderInputSchema = z.object({
  /** Agent ou service candidat que l'acheteur envisage d'acheter. */
  candidate: trimmed(3, 300),
  /** Mission confiée au candidat si l'achat se fait. */
  mission: trimmed(10, 2000),
  /** Budget engagé / exposition (montant, accès, dépendance). */
  budget_exposure: trimmed(3, 500),
  /** Ce qui se passe si le candidat échoue ou ment. */
  failure_consequence: trimmed(3, 1000),
  /** Contraintes ou garanties publiques déjà annoncées par le candidat. */
  public_constraints: z.string().trim().max(2000).optional(),
  /**
   * Contact privé de livraison (email ou URL joignable). Stocké dans le registre
   * privé pour livrer, jamais renvoyé dans la réponse ni exposé publiquement.
   */
  delivery_contact: trimmed(5, 320),
})

export type OrderInput = z.infer<typeof OrderInputSchema>

// ---------------------------------------------------------------------------
// Challenge x402
// ---------------------------------------------------------------------------

export function buildPaymentRequirements(config: PrepurchaseConfig): PaymentRequirementsV2 {
  const net = USDC_NETWORKS[config.network]
  return {
    scheme: 'exact',
    network: config.network,
    amount: PREPURCHASE_PRICE_ATOMIC,
    asset: config.asset,
    payTo: config.payTo,
    maxTimeoutSeconds: PREPURCHASE_MAX_TIMEOUT_SECONDS,
    extra: { assetTransferMethod: 'eip3009', name: net.eip712.name, version: net.eip712.version },
  }
}

export function buildPaymentRequired(config: PrepurchaseConfig, error?: string): PaymentRequiredV2 {
  return {
    x402Version: 2,
    ...(error ? { error } : {}),
    resource: {
      url: PREPURCHASE_RESOURCE_URL,
      description:
        'One fixed-scope manual pre-purchase evidence brief (facts, contradictions, missing evidence, safeguards, contextual recommendation) for one contemplated AI-agent purchase. Manual delivery within 24 hours. Payment buys the analysis only — never a rating, ranking or favorable treatment on Agent Reputation.',
      mimeType: 'application/json',
    },
    accepts: [buildPaymentRequirements(config)],
  }
}

// ---------------------------------------------------------------------------
// Validation du paiement reçu contre NOS exigences (avant tout appel réseau)
// ---------------------------------------------------------------------------

export type PaymentCheck = { ok: true; nonce: string; payer: string } | { ok: false; reason: string }

export function checkPaymentAgainstRequirements(
  payload: PaymentPayloadV2,
  required: PaymentRequirementsV2,
): PaymentCheck {
  const accepted = payload.accepted
  if (accepted.scheme !== required.scheme) return { ok: false, reason: 'scheme mismatch' }
  if (accepted.network !== required.network) return { ok: false, reason: 'network mismatch' }
  if (!sameAddress(accepted.asset, required.asset)) return { ok: false, reason: 'asset mismatch' }
  if (!sameAddress(accepted.payTo, required.payTo)) return { ok: false, reason: 'payTo mismatch' }
  if (accepted.amount !== required.amount) return { ok: false, reason: 'amount mismatch' }
  const auth = payload.payload.authorization
  if (!sameAddress(auth.to, required.payTo)) return { ok: false, reason: 'authorization.to does not pay the configured recipient' }
  if (auth.value !== required.amount) return { ok: false, reason: 'authorization.value does not match the price' }
  return { ok: true, nonce: auth.nonce.toLowerCase(), payer: auth.from }
}

/** ID de commande stable et rejouable, dérivé du nonce EIP-3009 (unique par autorisation). */
export function deriveOrderId(network: string, nonce: string): string {
  const digest = createHash('sha256').update(`${network}:${nonce.toLowerCase()}`).digest('hex')
  return `apo_${digest.slice(0, 20)}`
}

// ---------------------------------------------------------------------------
// Orchestration du POST payé, effets injectés (testable sans réseau/DB)
// ---------------------------------------------------------------------------

export type StoredOrder = {
  id: string
  network: string
  asset: string
  amountAtomic: string
  payTo: string
  payer: string | null
  paymentNonce: string
  paymentTransaction: string | null
  settledAt: string
  evidenceCutoff: string
  deliveryDeadline: string
  input: OrderInput
}

export type OrderReservation = Omit<
  StoredOrder,
  'payer' | 'paymentTransaction' | 'settledAt' | 'evidenceCutoff' | 'deliveryDeadline'
>

export type ReservationResult =
  | { status: 'reserved' }
  | { status: 'existing'; order: StoredOrder }
  | { status: 'cap_reached' }
  | { status: 'input_conflict' }

export type PaidOrderDeps = {
  findOrderByNonce: (network: string, nonce: string) => Promise<StoredOrder | null>
  verify: (payload: PaymentPayloadV2, requirements: PaymentRequirementsV2) => Promise<VerifyResponse>
  /**
   * Réserve atomiquement une place sous le plafond global, sous verrou DB.
   * Une réservation reste comptée jusqu'à règlement ou réconciliation manuelle :
   * on préfère fermer trop tôt plutôt que dépasser silencieusement le plafond.
   */
  reserve: (reservation: OrderReservation) => Promise<ReservationResult>
  settle: (payload: PaymentPayloadV2, requirements: PaymentRequirementsV2) => Promise<SettleResponse>
  /** Transforme atomiquement la réservation en commande réglée. */
  finalize: (order: StoredOrder) => Promise<StoredOrder>
  now: () => Date
}

export type PaidOrderResult =
  | { status: 'ok'; order: StoredOrder; settlement: SettleResponse | null; replay: boolean }
  | { status: 'invalid_payment'; reason: string }
  | { status: 'verify_failed'; reason: string }
  | { status: 'settle_failed'; reason: string }
  | { status: 'input_conflict' }
  | { status: 'cap_reached' }

export async function processPaidOrder(
  deps: PaidOrderDeps,
  config: PrepurchaseConfig,
  input: OrderInput,
  payload: PaymentPayloadV2,
): Promise<PaidOrderResult> {
  const required = buildPaymentRequirements(config)
  const check = checkPaymentAgainstRequirements(payload, required)
  if (!check.ok) return { status: 'invalid_payment', reason: check.reason }

  // Idempotence AVANT tout : un retry du même paiement rejoué renvoie la même
  // commande, même si le plafond a été atteint entre-temps.
  const existing = await deps.findOrderByNonce(config.network, check.nonce)
  if (existing) return { status: 'ok', order: existing, settlement: null, replay: true }

  const verification = await deps.verify(payload, required)
  if (!verification.isValid) {
    return {
      status: 'verify_failed',
      reason:
        verification.invalidReason ??
        verification.invalidMessage ??
        'facilitator rejected the payment',
    }
  }

  // Réservation DB APRÈS vérification cryptographique mais AVANT règlement. Le
  // verrou transactionnel de l'implémentation réelle rend le plafond global,
  // même avec plusieurs lambdas Vercel simultanées. Pas d'appel réseau sous verrou.
  const reservation: OrderReservation = {
    id: deriveOrderId(config.network, check.nonce),
    network: config.network,
    asset: config.asset,
    amountAtomic: PREPURCHASE_PRICE_ATOMIC,
    payTo: config.payTo,
    paymentNonce: check.nonce,
    input,
  }
  const reserved = await deps.reserve(reservation)
  if (reserved.status === 'existing') {
    return { status: 'ok', order: reserved.order, settlement: null, replay: true }
  }
  if (reserved.status === 'cap_reached') return { status: 'cap_reached' }
  if (reserved.status === 'input_conflict') return { status: 'input_conflict' }

  const settlement = await deps.settle(payload, required)
  if (!settlement.success) {
    // Un retry après un settle déjà passé côté facilitator mais perdu côté DB :
    // dernier recours, retenter la lecture par nonce avant de refuser.
    const recovered = await deps.findOrderByNonce(config.network, check.nonce)
    if (recovered) return { status: 'ok', order: recovered, settlement: null, replay: true }
    return {
      status: 'settle_failed',
      reason:
        settlement.errorReason ??
        settlement.errorMessage ??
        'settlement was not confirmed; the capacity reservation is retained for safe retry or reconciliation',
    }
  }

  const settledAt = deps.now()
  const order: StoredOrder = {
    id: deriveOrderId(config.network, check.nonce),
    network: config.network,
    asset: config.asset,
    amountAtomic: PREPURCHASE_PRICE_ATOMIC,
    payTo: config.payTo,
    payer: settlement.payer ?? check.payer,
    paymentNonce: check.nonce,
    paymentTransaction: settlement.transaction ?? null,
    settledAt: settledAt.toISOString(),
    // La preuve s'arrête au règlement : tout ce qui apparaît après n'entre pas
    // dans le brief (borne annoncée à l'acheteur).
    evidenceCutoff: settledAt.toISOString(),
    deliveryDeadline: new Date(settledAt.getTime() + PREPURCHASE_DELIVERY_HOURS * 3_600_000).toISOString(),
    input,
  }
  const storedOrder = await deps.finalize(order)
  return { status: 'ok', order: storedOrder, settlement, replay: false }
}

/** Reçu public : n'expose jamais le contact privé de livraison. */
export function orderReceipt(order: StoredOrder, settlement: SettleResponse | null) {
  return {
    order_id: order.id,
    status: 'paid' as const,
    accepted_scope: {
      service: 'manual pre-purchase evidence brief (fixed scope)',
      candidate: order.input.candidate,
      mission: order.input.mission,
      budget_exposure: order.input.budget_exposure,
      failure_consequence: order.input.failure_consequence,
      public_constraints: order.input.public_constraints ?? null,
    },
    payment: {
      network: order.network,
      asset: order.asset,
      amount_atomic: order.amountAtomic,
      transaction: order.paymentTransaction ?? settlement?.transaction ?? null,
      payer: order.payer,
      settled_at: order.settledAt,
    },
    evidence_cutoff: order.evidenceCutoff,
    delivery: {
      method: 'manual analysis, delivered to the private contact supplied in the order',
      deadline: order.deliveryDeadline,
    },
    neutrality:
      'Payment buys a contextual pre-purchase analysis only. It never buys a rating, a ranking, a verdict or any favorable treatment on Agent Reputation, for the buyer or for any seller.',
  }
}
