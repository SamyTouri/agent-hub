import {
  validateDiscoveryExtension,
  validateDiscoveryExtensionSpec,
  type DiscoveryExtension,
} from '@x402/extensions/bazaar'

import {
  buildPaymentRequirements,
  checkPaymentAgainstRequirements,
  CDP_FACILITATOR_URL,
  PREPURCHASE_PRICE_ATOMIC,
  PREPURCHASE_RESOURCE_URL,
  type OrderInput,
  type PrepurchaseConfig,
} from './prepurchase.ts'
import {
  decodeBase64Json,
  EVM_ADDRESS_RE,
  PaymentPayloadV2Schema,
  sameAddress,
  USDC_NETWORKS,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
} from './x402.ts'

// Gardes pures de l'ACHAT DE RÉFÉRENCEMENT : un unique règlement de 0,50 USDC
// réel sur Base mainnet, de notre portefeuille acheteur vers notre propre
// adresse d'encaissement, contre NOTRE route de production.
//
// Ce que ça achète réellement : rien de commercial. Le catalogue de découverte
// x402 (Bazaar) n'indexe une ressource qu'au PREMIER paiement effectivement
// réglé par le facilitateur CDP, et seulement si le défi portait les
// métadonnées de découverte. Il n'existe aucune inscription manuelle. Ce
// paiement est donc le seul geste qui nous fasse exister dans le catalogue que
// les agents acheteurs interrogent avant de payer un vendeur.
//
// Pourquoi un NOUVEAU règlement alors qu'un paiement mainnet a déjà eu lieu le
// 2026-07-25 : ce règlement-là est antérieur à l'ajout des métadonnées de
// découverte (2026-07-30). Un règlement sans métadonnées n'indexe rien et
// n'émet aucune erreur — c'est exactement le mode d'échec silencieux que le
// préflight et la vérification d'après-coup existent pour couvrir.
//
// Rien ici ne fait d'effet : pas de réseau, pas de secret, pas de signature.
// Les scripts fournissent les effets ; ces fonctions décident.

/**
 * Périmètre figé en dur. L'autorisation porte sur CE règlement. Un montant, un
 * réseau, un actif ou une adresse d'encaissement différents constituent une
 * NOUVELLE décision, jamais un paramètre de relance.
 *
 * L'adresse d'encaissement est ÉPINGLÉE et non déduite du défi : un défi qui
 * nommerait une autre adresse serait soit une production mal configurée, soit
 * un détournement. Dans les deux cas on refuse au lieu de payer.
 */
export const DISCOVERY_LISTING = {
  endpoint: PREPURCHASE_RESOURCE_URL,
  network: 'eip155:8453',
  asset: USDC_NETWORKS['eip155:8453'].usdc,
  amountAtomic: PREPURCHASE_PRICE_ATOMIC,
  amountDisplay: '0.50 USDC',
  /** Notre propre encaissement — l'argent ne sort pas de la maison. */
  recipient: '0x76e8a4Ac5B46c179aCCDfcd38281C4944749E3E4',
  /** Portefeuille CDP acheteur DÉJÀ provisionné : on n'en crée pas un nouveau. */
  buyerWalletAccountName: 'aghub-prepurchase-mainnet-buyer',
  buyerAddress: '0x5F3C44C54585fC96aA8E636BA4cF2bc438934c63',
  receiverWalletAccountName: 'aghub-prepurchase-mainnet-receiver',
  facilitatorUrl: CDP_FACILITATOR_URL,
  /** Nom de réseau CDP, pour la lecture des soldes. */
  cdpNetwork: 'base',
  /** Au-delà, le facilitateur CDP refuse le règlement. Vérifié en caractères ET en octets. */
  descriptionMaxLength: 500,
  /** Délai d'indexation annoncé côté catalogue. */
  indexingWindowHours: 6,
} as const

export const DISCOVERY_LISTING_EXECUTION_SENTINEL =
  'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-TO-LIST-AGENT-REPUTATION-IN-THE-X402-CATALOG'

/**
 * Réserve à rappeler AVANT la dépense, pas après. Le classement du catalogue se
 * joue sur le nombre d'acheteurs DISTINCTS, le nombre de paiements et la
 * fraîcheur sur trente jours. Un achat qu'on se fait à soi-même nous fait entrer
 * avec un seul acheteur, qui est nous.
 */
export const DISCOVERY_LISTING_RESERVE = [
  'Catalog ranking is driven by distinct buyers, payment count and 30-day freshness.',
  'A self-purchase enters the catalog with exactly one buyer, and that buyer is us.',
  'This is necessary to exist in the catalog. It buys no visibility until a real third party pays.',
  'Nothing here should ever be described publicly as traction, demand or a customer.',
] as const

/**
 * Ce que la reprise peut et ne peut pas faire, dit honnêtement.
 *
 * Différence FAVORABLE avec le rejeu d'un GET payé (cas 002) : notre vendeur
 * indexe les commandes sur le nonce EIP-3009 (`findOrderByNonce`). Rejouer la
 * même autorisation retrouve donc la commande déjà réglée et renvoie le même
 * `order_id`, sans second règlement. La reprise sert bien à récupérer le reçu
 * perdu — mais elle ne signe JAMAIS une seconde autorisation.
 */
export const DISCOVERY_LISTING_RECOVERY_LIMIT =
  'Recovery replays the identical signed authorization; it never signs a second one. The seller keys orders on the EIP-3009 nonce, so a replay returns the same order_id without settling twice. If the replay reports no settled order at all, the first attempt never reached settlement and the authorization may have expired — that is a new decision, not a retry.'

/**
 * Corps de commande VRAI. Cette ligne va vivre dans `prepurchase_orders` à côté
 * de vraies commandes : elle doit être auto-dénonciatrice, pour qu'aucun audit
 * futur (ni nous) ne puisse la confondre avec un client.
 */
export const DISCOVERY_LISTING_SELF_MARKER = 'SELF-PURCHASE — NOT A CUSTOMER'

export function buildDiscoveryListingOrder(): OrderInput {
  return {
    candidate: `${DISCOVERY_LISTING_SELF_MARKER} — agent-reputation-discovery-listing (no third-party candidate)`,
    mission:
      'Settle one real x402 payment against our own production offer so the CDP facilitator indexes this resource in the x402 discovery catalog. The catalog only indexes a resource on its first settled payment; there is no manual listing.',
    budget_exposure:
      'Exactly 0.50 USDC of real value, paid by Agent Reputation to its own dedicated receiver. No third party is exposed.',
    failure_consequence:
      'Without a settled payment carrying discovery metadata, the offer stays absent from the catalog that buying agents query, and no error is raised anywhere to signal it.',
    public_constraints:
      'Self-purchase with no commercial value. No brief is delivered, no buyer outcome is recorded, and this order must never be counted or described as demand, traction or a customer.',
    delivery_contact: 'discovery-listing@invalid.example',
  }
}

export function discoveryListingExecutionErrors(input: {
  execute: boolean
  authorizeFlag: boolean
  env: Record<string, string | undefined>
}): string[] {
  const errors: string[] = []
  if (!input.execute) errors.push('missing --execute')
  if (!input.authorizeFlag) errors.push('missing --i-authorize-discovery-listing-payment')
  if (input.env.DISCOVERY_LISTING_EXECUTE !== DISCOVERY_LISTING_EXECUTION_SENTINEL) {
    errors.push(`DISCOVERY_LISTING_EXECUTE must equal ${DISCOVERY_LISTING_EXECUTION_SENTINEL}`)
  }
  if (!input.env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!input.env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!input.env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

/**
 * Limites SDK redondantes, indépendantes de l'évaluation du défi : deux
 * mécanismes séparés doivent être d'accord pour qu'un centime bouge. Le cumul
 * sur 24 h vaut exactement UN règlement, donc même une boucle ne peut pas payer
 * deux fois.
 */
export function buildDiscoveryListingSpendControls() {
  return {
    maxAmountPerPayment: {
      atomic: BigInt(DISCOVERY_LISTING.amountAtomic),
      asset: DISCOVERY_LISTING.asset,
    },
    maxCumulativeSpend: {
      atomic: BigInt(DISCOVERY_LISTING.amountAtomic),
      asset: DISCOVERY_LISTING.asset,
    },
    maxCumulativeSpendWindow: '24h' as const,
    allowedNetworks: [DISCOVERY_LISTING.network],
    allowedAssets: [DISCOVERY_LISTING.asset],
    allowedPayees: [DISCOVERY_LISTING.recipient],
    maxLedgerEntries: 5,
  }
}

function pinnedConfig(): PrepurchaseConfig {
  return {
    network: DISCOVERY_LISTING.network,
    asset: DISCOVERY_LISTING.asset,
    payTo: DISCOVERY_LISTING.recipient,
    facilitatorUrl: DISCOVERY_LISTING.facilitatorUrl,
    facilitatorKind: 'cdp',
    mainnet: true,
  }
}

/** Exigences ÉPINGLÉES, jamais dérivées du défi qu'on est en train d'évaluer. */
export function buildDiscoveryListingRequirements(): PaymentRequirementsV2 {
  return buildPaymentRequirements(pinnedConfig(), DISCOVERY_LISTING.amountAtomic)
}

export type ListingCheck = { name: string; ok: boolean; detail: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Contrôle du texte que le facilitateur va lire. Un dépassement ne produit pas
 * une erreur lisible côté catalogue : le règlement est simplement refusé, ou
 * pire, passe sans être indexé. On mesure donc les deux unités plausibles et on
 * refuse dès que l'une dépasse.
 */
export function checkDiscoveryDescription(description: unknown): ListingCheck[] {
  if (typeof description !== 'string' || description.trim() === '') {
    return [
      {
        name: 'discovery-description-present',
        ok: false,
        detail: 'the challenge carries no resource description; the catalog would index an unreadable entry',
      },
    ]
  }
  const chars = [...description].length
  const bytes = Buffer.byteLength(description, 'utf8')
  const max = DISCOVERY_LISTING.descriptionMaxLength
  return [
    { name: 'discovery-description-present', ok: true, detail: `${chars} characters / ${bytes} bytes` },
    {
      name: 'discovery-description-within-cap',
      ok: chars <= max && bytes <= max,
      detail: `chars=${chars} bytes=${bytes} cap=${max} (checked in both units; the facilitator refuses settlement beyond it)`,
    },
  ]
}

/**
 * Présence ET validité des métadonnées de découverte. Leur absence est le mode
 * d'échec le plus coûteux du dossier : le paiement part, rien n'est indexé, et
 * aucune erreur n'apparaît nulle part.
 */
export function checkDiscoveryExtension(extensions: unknown): ListingCheck[] {
  const record = asRecord(extensions)
  const bazaar = record ? asRecord(record.bazaar) : null
  if (!bazaar) {
    return [
      {
        name: 'discovery-extension-declared',
        ok: false,
        detail:
          'no "bazaar" discovery extension in the challenge; a settlement would move real money and index nothing, silently',
      },
    ]
  }

  const checks: ListingCheck[] = [
    { name: 'discovery-extension-declared', ok: true, detail: 'extensions.bazaar is present' },
  ]

  // On passe par les validateurs officiels plutôt que de deviner la forme
  // attendue : c'est le même code que celui qui juge côté facilitateur.
  const spec = validateDiscoveryExtensionSpec(bazaar)
  checks.push({
    name: 'discovery-extension-spec-valid',
    ok: spec.valid,
    detail: spec.valid ? 'protocol-level shape accepted' : (spec.errors ?? ['unknown error']).join('; '),
  })

  const internal = validateDiscoveryExtension(bazaar as unknown as DiscoveryExtension)
  checks.push({
    name: 'discovery-extension-consistent',
    ok: internal.valid,
    detail: internal.valid
      ? 'declared info matches its own schema'
      : (internal.errors ?? ['unknown error']).join('; '),
  })

  const info = asRecord(bazaar.info)
  const input = info ? asRecord(info.input) : null
  checks.push({
    name: 'discovery-declares-post-json',
    ok: String(input?.type ?? '') === 'http' && String(input?.method ?? '').toUpperCase() === 'POST',
    detail: `type=${String(input?.type ?? '(missing)')} method=${String(input?.method ?? '(missing)')}`,
  })

  return checks
}

export type DiscoveryListingChallenge =
  | { ok: true; checks: ListingCheck[]; decoded: Record<string, unknown> }
  | { ok: false; checks: ListingCheck[]; decoded: Record<string, unknown> | null; reason: string }

/**
 * Évaluation complète du défi non signé. Fail-closed : tout ce qui n'est pas
 * explicitement conforme fait NO-GO. `challengeStatus` doit être 402 — un 503
 * signifie que l'offre est inactive et qu'aucun paiement ne doit partir.
 */
export function evaluateDiscoveryListingChallenge(input: {
  challengeStatus: number
  paymentRequiredHeader: string | null
}): DiscoveryListingChallenge {
  const fail = (checks: ListingCheck[], decoded: Record<string, unknown> | null, reason: string) =>
    ({ ok: false as const, checks, decoded, reason })

  const statusCheck: ListingCheck = {
    name: 'unsigned-order-returns-402',
    ok: input.challengeStatus === 402,
    detail:
      input.challengeStatus === 402
        ? 'HTTP 402'
        : `HTTP ${input.challengeStatus}; 503 means the offer is inactive and nothing must be paid`,
  }
  if (!statusCheck.ok) return fail([statusCheck], null, statusCheck.detail)

  if (!input.paymentRequiredHeader) {
    const check: ListingCheck = {
      name: 'payment-required-header',
      ok: false,
      detail: 'the 402 carries no PAYMENT-REQUIRED header',
    }
    return fail([statusCheck, check], null, check.detail)
  }
  const decoded = asRecord(decodeBase64Json(input.paymentRequiredHeader))
  if (!decoded) {
    const check: ListingCheck = {
      name: 'payment-required-header',
      ok: false,
      detail: 'PAYMENT-REQUIRED did not decode to a JSON object',
    }
    return fail([statusCheck, check], null, check.detail)
  }

  const resource = asRecord(decoded.resource)
  const accepts = Array.isArray(decoded.accepts) ? decoded.accepts.map(asRecord) : []
  const offer = accepts.find((entry) => entry && String(entry.scheme ?? '') === 'exact') ?? null
  const required = buildDiscoveryListingRequirements()

  const checks: ListingCheck[] = [
    statusCheck,
    { name: 'payment-required-header', ok: true, detail: 'decoded' },
    {
      name: 'x402-version-2',
      ok: decoded.x402Version === 2,
      detail: `x402Version=${String(decoded.x402Version ?? '(missing)')}`,
    },
    {
      name: 'resource-is-our-endpoint',
      ok: String(resource?.url ?? '') === DISCOVERY_LISTING.endpoint,
      detail: `resource=${String(resource?.url ?? '(missing)')} expected=${DISCOVERY_LISTING.endpoint}`,
    },
    {
      name: 'scheme-exact-offered',
      ok: Boolean(offer),
      detail: offer ? 'exact scheme offered' : 'no "exact" offer in accepts',
    },
    {
      name: 'network-is-base-mainnet',
      ok: String(offer?.network ?? '') === DISCOVERY_LISTING.network,
      detail: `network=${String(offer?.network ?? '(missing)')} expected=${DISCOVERY_LISTING.network}`,
    },
    {
      name: 'asset-is-native-base-usdc',
      ok: sameAddress(String(offer?.asset ?? ''), required.asset),
      detail: `asset=${String(offer?.asset ?? '(missing)')} expected=${required.asset}`,
    },
    {
      name: 'amount-is-exactly-the-offer-price',
      ok: String(offer?.amount ?? '') === required.amount,
      detail: `amount=${String(offer?.amount ?? '(missing)')} expected=${required.amount} (${DISCOVERY_LISTING.amountDisplay})`,
    },
    {
      name: 'recipient-is-our-pinned-receiver',
      ok: sameAddress(String(offer?.payTo ?? ''), required.payTo),
      detail: `payTo=${String(offer?.payTo ?? '(missing)')} expected=${required.payTo}`,
    },
    ...checkDiscoveryDescription(resource?.description),
    ...checkDiscoveryExtension(decoded.extensions),
  ]

  const failed = checks.filter((check) => !check.ok)
  if (failed.length > 0) {
    return fail(checks, decoded, failed.map((check) => `${check.name} (${check.detail})`).join('; '))
  }
  return { ok: true, checks, decoded }
}

export type DiscoveryListingPayloadCheck =
  | { ok: true; payload: PaymentPayloadV2; nonce: string; payer: string }
  | { ok: false; reason: string }

/**
 * Dernière validation locale du payload signé, AVANT qu'il ne quitte le
 * processus. Délibérément redondante avec les spend controls CDP.
 */
export function validateDiscoveryListingPaymentPayload(payload: unknown): DiscoveryListingPayloadCheck {
  const parsed = PaymentPayloadV2Schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, reason: 'the CDP client produced an unreadable x402 v2 payload' }
  }
  const check = checkPaymentAgainstRequirements(
    parsed.data as PaymentPayloadV2,
    buildDiscoveryListingRequirements(),
  )
  if (!check.ok) return { ok: false, reason: check.reason }
  return { ok: true, payload: parsed.data as PaymentPayloadV2, nonce: check.nonce, payer: check.payer }
}

/** Le payeur signé doit être exactement le portefeuille dont on croit se servir. */
export function assertDiscoveryListingSigner(walletAddress: string, signedPayer: string): string | null {
  if (!EVM_ADDRESS_RE.test(walletAddress)) return 'the CDP wallet address is not a valid EVM address'
  if (!sameAddress(walletAddress, signedPayer)) {
    return 'CDP wallet address and signed payer address do not match'
  }
  if (!sameAddress(walletAddress, DISCOVERY_LISTING.buyerAddress)) {
    return `the CDP wallet is ${walletAddress} but the pinned buyer is ${DISCOVERY_LISTING.buyerAddress}`
  }
  return null
}

export type PendingDiscoveryListingPayment = {
  version: 1
  case: 'discovery-listing'
  created_at: string
  endpoint: string
  request_body: OrderInput
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
 * fichier pointant ailleurs est refusé plutôt que rejoué : c'est ce qui empêche
 * une seconde autorisation de naître silencieusement d'un ancien fichier.
 */
export function validatePendingDiscoveryListing(raw: unknown): string | null {
  const pending = asRecord(raw) as Partial<PendingDiscoveryListingPayment> | null
  if (!pending) return 'the recovery file is not a JSON object'
  if (pending.version !== 1) return 'unsupported recovery file version'
  if (pending.case !== 'discovery-listing') return 'the recovery file does not belong to the discovery listing'
  if (typeof pending.payment_signature_header !== 'string' || !pending.payment_signature_header) {
    return 'the recovery file has no signed authorization to replay (it may already be a completed proof)'
  }
  if (typeof pending.nonce !== 'string' || !pending.nonce) return 'the recovery file has no nonce'
  if (pending.endpoint !== DISCOVERY_LISTING.endpoint) {
    return `the recovery file targets ${String(pending.endpoint)} but this tool only pays ${DISCOVERY_LISTING.endpoint}`
  }
  if (pending.amount_atomic !== DISCOVERY_LISTING.amountAtomic) {
    return 'the recovery file does not carry the authorized amount'
  }
  if (pending.network !== DISCOVERY_LISTING.network) return 'the recovery file is not for Base mainnet'
  if (pending.asset !== DISCOVERY_LISTING.asset) return 'the recovery file does not carry the authorized asset'
  if (!sameAddress(String(pending.recipient ?? ''), DISCOVERY_LISTING.recipient)) {
    return 'the recovery file does not carry the authorized recipient'
  }
  if (!pending.request_body || typeof pending.request_body !== 'object') {
    return 'the recovery file has no order body to replay'
  }
  return null
}

// ---------------------------------------------------------------------------
// Vérification d'après-coup
// ---------------------------------------------------------------------------

export type CatalogItem = {
  resource?: unknown
  type?: unknown
  lastUpdated?: unknown
  accepts?: unknown
  description?: unknown
  extensions?: unknown
}

export type CatalogLookup = {
  listed: boolean
  matched: CatalogItem | null
  scanned: number
  /** Entrées qui parlent de nous mais dont l'URL ne correspond pas exactement. */
  nearMisses: string[]
}

/**
 * Recherche PURE de notre ressource dans une page de catalogue. Comparée sur
 * l'URL exacte : une entrée voisine (autre chemin, autre hôte) n'est pas nous et
 * ne doit pas être comptée comme une inscription réussie.
 */
export function findDiscoveryListing(items: unknown): CatalogLookup {
  const list = Array.isArray(items) ? items : []
  let matched: CatalogItem | null = null
  const nearMisses: string[] = []

  for (const raw of list) {
    const item = asRecord(raw)
    if (!item) continue
    const resource = typeof item.resource === 'string' ? item.resource : ''
    if (resource === DISCOVERY_LISTING.endpoint) {
      matched ??= item as CatalogItem
    } else if (resource.includes('agentreputation.dev')) {
      nearMisses.push(resource)
    }
  }

  return { listed: matched !== null, matched, scanned: list.length, nearMisses }
}

/**
 * Verdict d'indexation, en tenant compte de la fenêtre annoncée. Ne pas être
 * listé une heure après le règlement n'est PAS un échec ; ne pas l'être après la
 * fenêtre en est un, et il faut alors soupçonner les métadonnées, pas le réseau.
 *
 * `scanComplete` est ce qui sépare « absent » de « pas trouvé ». Le facilitateur
 * ignore ses propres filtres et le catalogue dépasse 15 000 entrées : une
 * absence constatée sur un parcours partiel ne prouve rien et ne doit jamais
 * être présentée comme un échec d'indexation.
 */
export function judgeIndexing(input: {
  listed: boolean
  settledAt: string | null
  now: Date
  scanComplete?: boolean
}): {
  verdict: 'listed' | 'pending' | 'overdue' | 'unknown_settlement' | 'inconclusive_scan'
  detail: string
} {
  if (input.listed) {
    return { verdict: 'listed', detail: 'the resource is present in the discovery catalog' }
  }
  if (input.scanComplete === false) {
    return {
      verdict: 'inconclusive_scan',
      detail:
        'the catalog was only partially read, so absence proves nothing. Re-run the check rather than concluding that indexing failed.',
    }
  }
  if (!input.settledAt) {
    return {
      verdict: 'unknown_settlement',
      detail: 'no settlement timestamp is available, so the indexing window cannot be judged',
    }
  }
  const settled = new Date(input.settledAt)
  if (Number.isNaN(settled.getTime())) {
    return { verdict: 'unknown_settlement', detail: `unreadable settlement timestamp: ${input.settledAt}` }
  }
  const elapsedHours = (input.now.getTime() - settled.getTime()) / 3_600_000
  if (elapsedHours <= DISCOVERY_LISTING.indexingWindowHours) {
    return {
      verdict: 'pending',
      detail: `${elapsedHours.toFixed(1)}h since settlement; indexing is announced to take up to ${DISCOVERY_LISTING.indexingWindowHours}h. Check again later.`,
    }
  }
  return {
    verdict: 'overdue',
    detail: `${elapsedHours.toFixed(1)}h since settlement, past the ${DISCOVERY_LISTING.indexingWindowHours}h window. Suspect the discovery metadata on the challenge that was actually paid, not the network: a metadata defect raises no error anywhere.`,
  }
}
