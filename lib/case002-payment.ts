import {
  buildCase002ResourceUrl,
  CASE002_PREFLIGHT,
  evaluateCase002Challenge,
  evaluateCase002Manifest,
  resolveCase002SellerBase,
} from './case002-preflight.ts'
import { checkPaymentAgainstRequirements } from './prepurchase.ts'
import {
  EVM_ADDRESS_RE,
  PaymentPayloadV2Schema,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
} from './x402.ts'

// Gardes pures du SEUL achat Case-002 autorisé par Samy (2026-07-26) :
// GET /v1/page-signals?url=https://agentreputation.dev/ contre exactement
// 0,05 USDC natif sur Base mainnet, au destinataire déjà documenté.
//
// Rien ici ne fait d'effet : pas de réseau, pas de secret, pas de signature.
// `scripts/case-002-pay.mts` fournit les effets ; ces fonctions décident.
//
// Différence STRUCTURELLE avec Case-001 : le produit est un GET, donc paiement et
// livraison voyagent dans la MÊME réponse HTTP. Il n'existe pas de commande
// idempotente côté vendeur à laquelle se raccrocher — d'où le soin particulier
// autour de la reprise (voir CASE002_RECOVERY_LIMIT).

/**
 * Périmètre figé en dur : l'autorisation de Samy porte sur CET achat. Un produit,
 * un prix, un réseau, un actif ou un destinataire différent est une NOUVELLE
 * décision d'achat, jamais un paramètre de relance.
 */
export const CASE002_PAYMENT = {
  handle: CASE002_PREFLIGHT.handle,
  profileUrl: CASE002_PREFLIGHT.profileUrl,
  productPath: CASE002_PREFLIGHT.productPath,
  targetUrl: CASE002_PREFLIGHT.targetUrl,
  network: CASE002_PREFLIGHT.network,
  asset: CASE002_PREFLIGHT.asset,
  recipient: CASE002_PREFLIGHT.recipient,
  amountAtomic: CASE002_PREFLIGHT.amountAtomic,
  amountDisplay: '0.05 USDC',
  /** Wallet CDP mainnet DÉJÀ provisionné et financé — on n'en crée pas un nouveau. */
  walletAccountName: 'aghub-prepurchase-mainnet-buyer',
} as const

export const CASE002_EXECUTION_SENTINEL =
  'I-AUTHORIZE-EXACTLY-0.05-REAL-USDC-FOR-AGENT-REPUTATION-CASE-002'

/**
 * The one purchase authorized by Samy settled and delivered on 2026-07-26.
 * This tracked, fail-closed switch keeps the buyer inert even if its local completed
 * evidence file is later removed. A future purchase requires a new case and authorization.
 */
export const CASE002_AUTHORIZATION_CONSUMED_AT = '2026-07-26T10:03:05.000Z'

/**
 * Limite honnête de la reprise. Sur un GET payé, l'artefact acheté est le corps de
 * la réponse : si la réponse est perdue, rejouer la MÊME autorisation ne peut pas
 * garantir sa relivraison — le nonce EIP-3009 est déjà consommé, donc le vendeur
 * peut légitimement refuser. La reprise sert à savoir ce qui s'est passé et à ne
 * jamais signer une seconde fois, pas à récupérer la marchandise à coup sûr.
 */
export const CASE002_RECOVERY_LIMIT =
  'Recovery replays the identical signed authorization; it never signs a second one. On a paid GET the purchased artefact is the response body, so a lost response may cost 0.05 USDC without yielding the artefact. That outcome must be recorded as paid-without-delivery, never as a delivery failure of unknown cause.'

export function case002AuthorizationErrors(input: {
  execute: boolean
  authorizeFlag: boolean
  env: Record<string, string | undefined>
}): string[] {
  const errors: string[] = []
  if (CASE002_AUTHORIZATION_CONSUMED_AT) {
    errors.push(
      `Case-002 authorization was consumed at ${CASE002_AUTHORIZATION_CONSUMED_AT}; a new purchase requires a new case and explicit authorization`,
    )
  }
  if (!input.execute) errors.push('missing --execute')
  if (!input.authorizeFlag) errors.push('missing --i-authorize-case-002-payment')
  if (input.env.CASE002_EXECUTE !== CASE002_EXECUTION_SENTINEL) {
    errors.push(`CASE002_EXECUTE must equal ${CASE002_EXECUTION_SENTINEL}`)
  }
  if (!input.env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!input.env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!input.env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

/** Limites SDK redondantes : ce chemin ne peut pas dépenser plus que cet achat. */
export function buildCase002SpendControls() {
  return {
    maxAmountPerPayment: {
      atomic: BigInt(CASE002_PAYMENT.amountAtomic),
      asset: CASE002_PAYMENT.asset,
    },
    maxCumulativeSpend: {
      atomic: BigInt(CASE002_PAYMENT.amountAtomic),
      asset: CASE002_PAYMENT.asset,
    },
    // Une seconde signature dans la journée serait refusée par le SDK lui-même :
    // fail-safe assumé, cohérent avec le banc mainnet.
    maxCumulativeSpendWindow: '24h' as const,
    allowedNetworks: [CASE002_PAYMENT.network],
    allowedAssets: [CASE002_PAYMENT.asset],
    // Le destinataire attendu est celui du VENDEUR, jamais un de nos comptes.
    allowedPayees: [CASE002_PAYMENT.recipient],
    maxLedgerEntries: 5,
  }
}

/** Exigences de paiement du VENDEUR — jamais dérivées du prix de notre propre offre. */
export function buildCase002SellerRequirements(): PaymentRequirementsV2 {
  return {
    scheme: 'exact',
    network: CASE002_PAYMENT.network,
    amount: CASE002_PAYMENT.amountAtomic,
    asset: CASE002_PAYMENT.asset,
    payTo: CASE002_PAYMENT.recipient,
    maxTimeoutSeconds: 600,
  }
}

export type Case002Revalidation =
  | { ok: true; sellerBase: string; resourceUrl: string; manifestUrl: string }
  | { ok: false; reason: string }

/**
 * Revalidation OBLIGATOIRE dans la session de paiement : on repart du profil
 * annuaire (l'agent y republie son hôte), jamais d'une URL mémorisée. Réutilise
 * les mêmes évaluateurs que le préflight en lecture seule — un seul jeu de règles.
 */
export function revalidateCase002(input: {
  profileStatus: number
  profileHtml: string
  manifestStatus: number
  manifest: unknown
  challengeStatus: number
  paymentRequiredHeader: string | null
}): Case002Revalidation {
  if (input.profileStatus !== 200) {
    return { ok: false, reason: `directory profile returned HTTP ${input.profileStatus}` }
  }

  let sellerBase: string
  try {
    sellerBase = resolveCase002SellerBase(input.profileHtml)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  const resourceUrl = buildCase002ResourceUrl(sellerBase)
  const manifestUrl = new URL(CASE002_PREFLIGHT.manifestPath, sellerBase).toString()

  if (input.manifestStatus !== 200) {
    return { ok: false, reason: `seller manifest returned HTTP ${input.manifestStatus}` }
  }
  const manifestEvaluation = evaluateCase002Manifest(input.manifest)
  if (!manifestEvaluation.ok) {
    const failed = manifestEvaluation.checks.filter((check) => !check.ok)
    return { ok: false, reason: `manifest mismatch: ${failed.map((c) => `${c.name} (${c.detail})`).join('; ')}` }
  }

  if (input.challengeStatus !== 402) {
    return { ok: false, reason: `unsigned resource returned HTTP ${input.challengeStatus}; expected 402` }
  }
  const challengeEvaluation = evaluateCase002Challenge(input.paymentRequiredHeader, resourceUrl)
  if (!challengeEvaluation.ok) {
    const failed = challengeEvaluation.checks.filter((check) => !check.ok)
    return { ok: false, reason: `challenge mismatch: ${failed.map((c) => `${c.name} (${c.detail})`).join('; ')}` }
  }

  return { ok: true, sellerBase, resourceUrl, manifestUrl }
}

export type Case002PayloadCheck =
  | { ok: true; payload: PaymentPayloadV2; nonce: string; payer: string }
  | { ok: false; reason: string }

/**
 * Dernière validation locale du payload produit par le SDK, AVANT qu'il ne quitte
 * le processus. Délibérément redondante avec les spend controls CDP : deux
 * mécanismes indépendants doivent être d'accord pour qu'un centime bouge.
 */
export function validateCase002PaymentPayload(payload: unknown): Case002PayloadCheck {
  const parsed = PaymentPayloadV2Schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, reason: 'the CDP client produced an unreadable x402 v2 payload' }
  }
  const check = checkPaymentAgainstRequirements(
    parsed.data as PaymentPayloadV2,
    buildCase002SellerRequirements(),
  )
  if (!check.ok) return { ok: false, reason: check.reason }
  return {
    ok: true,
    payload: parsed.data as PaymentPayloadV2,
    nonce: check.nonce,
    payer: check.payer,
  }
}

/** Le payeur signé doit être exactement le wallet dont on croit se servir. */
export function assertSigningWalletMatches(walletAddress: string, signedPayer: string): string | null {
  if (!EVM_ADDRESS_RE.test(walletAddress)) return 'the CDP wallet address is not a valid EVM address'
  if (walletAddress.toLowerCase() !== signedPayer.toLowerCase()) {
    return 'CDP wallet address and signed payer address do not match'
  }
  return null
}

export type PendingCase002Payment = {
  version: 1
  case: 'case-002'
  created_at: string
  resource_url: string
  seller_base: string
  payment_signature_header: string
  payer: string
  nonce: string
  amount_atomic: string
  network: string
  asset: string
  recipient: string
}

/**
 * Une reprise ne vaut que pour LA MÊME autorisation, sur la même ressource. Un
 * fichier de reprise pointant ailleurs est refusé plutôt que rejoué : c'est ce qui
 * empêche une seconde autorisation de naître silencieusement d'un ancien fichier.
 */
export function validatePendingCase002(raw: unknown, expectedResourceUrl: string): string | null {
  const pending = raw as Partial<PendingCase002Payment> | null
  if (!pending || typeof pending !== 'object') return 'the recovery file is not a JSON object'
  if (pending.version !== 1) return 'unsupported recovery file version'
  if (pending.case !== 'case-002') return 'the recovery file does not belong to Case-002'
  if (typeof pending.payment_signature_header !== 'string' || !pending.payment_signature_header) {
    return 'the recovery file has no signed authorization to replay'
  }
  if (typeof pending.nonce !== 'string' || !pending.nonce) return 'the recovery file has no nonce'
  if (pending.resource_url !== expectedResourceUrl) {
    return `the recovery file targets ${String(pending.resource_url)} but this session resolved ${expectedResourceUrl}`
  }
  if (pending.amount_atomic !== CASE002_PAYMENT.amountAtomic) {
    return 'the recovery file does not carry the authorized amount'
  }
  if (pending.network !== CASE002_PAYMENT.network) return 'the recovery file is not for Base mainnet'
  if (pending.asset !== CASE002_PAYMENT.asset) return 'the recovery file does not carry the authorized asset'
  if (pending.recipient !== CASE002_PAYMENT.recipient) {
    return 'the recovery file does not carry the authorized recipient'
  }
  return null
}

/**
 * Résumé terminal borné : de quoi juger l'issue sans déverser l'artefact acheté
 * (qui vit dans le fichier d'évidence) ni la signature rejouable.
 */
export function summarizeCase002Delivery(input: {
  httpStatus: number
  bodyText: string
  contentType: string | null
  transaction: string | null
  payer: string
  nonce: string
  bodySha256: string
  evidencePath: string
}) {
  const preview = input.bodyText.slice(0, 600)
  return {
    status: input.httpStatus === 200 ? 'paid_and_delivered' : 'paid_response_not_ok',
    case: 'case-002',
    payment: {
      network: CASE002_PAYMENT.network,
      asset: CASE002_PAYMENT.asset,
      amount_atomic: CASE002_PAYMENT.amountAtomic,
      recipient: CASE002_PAYMENT.recipient,
      payer: input.payer,
      nonce: input.nonce,
      transaction: input.transaction,
    },
    delivery: {
      http_status: input.httpStatus,
      content_type: input.contentType,
      body_sha256: input.bodySha256,
      body_bytes: Buffer.byteLength(input.bodyText, 'utf8'),
      body_preview: preview,
      truncated: input.bodyText.length > preview.length,
    },
    correctness: 'NOT ASSESSED — reproduce the fields independently against the public page.',
    buyer_judgment: 'NOT RECORDED — a separate human assessment against the acceptance test.',
    public_claim: 'NONE — nothing is published automatically from this run.',
    full_response_evidence: input.evidencePath,
    separation_note:
      'Settlement, delivery, correctness and buyer judgment are four distinct facts. A transaction proves only that value moved.',
  }
}
