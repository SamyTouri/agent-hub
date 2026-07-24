import { z } from 'zod'

// Primitives x402 v2 partagées entre le endpoint vendeur (/api/prepurchase/order)
// et l'outil acheteur (scripts/case-001-preflight.mts).
//
// Validation locale, volontairement plus étroite que la spec officielle v2
// (x402-foundation/x402) : uniquement le scheme `exact` EVM/EIP-3009 dont le
// pilote a besoin. L'encodage HTTP est compatible avec @x402/core et testé
// contre lui. Les effets sensibles ne sont pas réimplémentés : le vendeur
// délègue verify/settle au client facilitator officiel et l'acheteur confie la
// création/signature du payload au client CDP officiel.

// Headers du transport HTTP v2 (les headers v1 X-PAYMENT/X-PAYMENT-RESPONSE sont legacy).
export const HEADER_PAYMENT_REQUIRED = 'PAYMENT-REQUIRED'
export const HEADER_PAYMENT_SIGNATURE = 'PAYMENT-SIGNATURE'
export const HEADER_PAYMENT_RESPONSE = 'PAYMENT-RESPONSE'

export const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
export const EVM_NONCE_RE = /^0x[0-9a-fA-F]{64}$/

/** Réseaux supportés — volontairement limités à Base Sepolia (défaut) et Base mainnet (gaté). */
export const USDC_NETWORKS = {
  'eip155:84532': {
    caip2: 'eip155:84532' as const,
    label: 'Base Sepolia (testnet)',
    // USDC testnet officiel Circle sur Base Sepolia.
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    // Domaine EIP-712 du contrat (requis par le client pour signer EIP-3009).
    eip712: { name: 'USDC', version: '2' },
    mainnet: false,
    v1Name: 'base-sepolia',
  },
  'eip155:8453': {
    caip2: 'eip155:8453' as const,
    label: 'Base (mainnet)',
    // USDC natif Circle sur Base.
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    // À revérifier on-chain avant toute activation mainnet (name() du contrat).
    eip712: { name: 'USD Coin', version: '2' },
    mainnet: true,
    v1Name: 'base',
  },
} as const

export type UsdcNetworkId = keyof typeof USDC_NETWORKS

export type ResourceInfo = { url: string; description?: string; mimeType?: string }

export type PaymentRequirementsV2 = {
  scheme: 'exact'
  network: string // CAIP-2, ex. "eip155:84532"
  amount: string // unités atomiques (USDC : 6 décimales)
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: Record<string, unknown>
}

export type PaymentRequiredV2 = {
  x402Version: 2
  error?: string
  resource: ResourceInfo
  accepts: PaymentRequirementsV2[]
  extensions?: Record<string, unknown>
}

export type VerifyResponse = {
  isValid: boolean
  payer?: string
  invalidReason?: string
  invalidMessage?: string
}
export type SettleResponse = {
  success: boolean
  payer?: string
  transaction?: string
  network?: string
  errorReason?: string
  errorMessage?: string
  amount?: string
}

const PaymentRequirementsSchema = z.looseObject({
  scheme: z.string(),
  network: z.string(),
  amount: z.string().regex(/^[0-9]+$/),
  asset: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

/** Payload du scheme exact/EVM en méthode EIP-3009 (transferWithAuthorization). */
const ExactEvmPayloadSchema = z.looseObject({
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  authorization: z.looseObject({
    from: z.string().regex(EVM_ADDRESS_RE),
    to: z.string().regex(EVM_ADDRESS_RE),
    value: z.string().regex(/^[0-9]+$/),
    validAfter: z.string().regex(/^[0-9]+$/),
    validBefore: z.string().regex(/^[0-9]+$/),
    nonce: z.string().regex(EVM_NONCE_RE),
  }),
})

export const PaymentPayloadV2Schema = z.looseObject({
  x402Version: z.literal(2),
  resource: z.looseObject({ url: z.string() }).optional(),
  accepted: PaymentRequirementsSchema,
  payload: ExactEvmPayloadSchema,
  extensions: z.record(z.string(), z.unknown()).optional(),
})

export type PaymentPayloadV2 = z.infer<typeof PaymentPayloadV2Schema>

const MAX_HEADER_BYTES = 16_384
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

export function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

/** Décode un header base64→JSON avec borne de taille ; retourne null si invalide. */
export function decodeBase64Json(value: string): unknown | null {
  if (
    !value ||
    value.length > MAX_HEADER_BYTES ||
    value.length % 4 !== 0 ||
    !BASE64_RE.test(value)
  ) {
    return null
  }
  let text: string
  try {
    const buf = Buffer.from(value, 'base64')
    if (buf.length === 0 || buf.length > MAX_HEADER_BYTES) return null
    text = buf.toString('utf8')
  } catch {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function sameAddress(a: string, b: string): boolean {
  return EVM_ADDRESS_RE.test(a) && EVM_ADDRESS_RE.test(b) && a.toLowerCase() === b.toLowerCase()
}

// ---------------------------------------------------------------------------
// Côté acheteur : normalisation d'un challenge observé (v1 ou v2) + évaluation
// contre des attentes explicites. Aucune signature, aucune dépense ici.
// ---------------------------------------------------------------------------

export type NormalizedOffer = {
  x402Version: number
  scheme: string
  network: string // normalisé en CAIP-2 quand le nom v1 est connu
  amountAtomic: bigint | null
  asset: string
  payTo: string
  raw: Record<string, unknown>
}

const V1_NETWORK_NAMES: Record<string, string> = {
  base: 'eip155:8453',
  'base-sepolia': 'eip155:84532',
}

function toCaip2(network: string): string {
  return V1_NETWORK_NAMES[network] ?? network
}

/**
 * Extrait les offres de paiement d'une réponse observée : header v2
 * PAYMENT-REQUIRED (base64) et/ou body JSON v1/v2 avec `accepts`.
 */
export function normalizeChallenges(input: {
  paymentRequiredHeader?: string | null
  body?: unknown
}): NormalizedOffer[] {
  const offers: NormalizedOffer[] = []
  const sources: unknown[] = []
  if (input.paymentRequiredHeader) sources.push(decodeBase64Json(input.paymentRequiredHeader))
  if (input.body) sources.push(input.body)

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const record = source as Record<string, unknown>
    const version = typeof record.x402Version === 'number' ? record.x402Version : 0
    const accepts = Array.isArray(record.accepts) ? record.accepts : []
    for (const entry of accepts) {
      if (!entry || typeof entry !== 'object') continue
      const req = entry as Record<string, unknown>
      // v2 : `amount` ; v1 : `maxAmountRequired`. Les deux sont en unités atomiques.
      const rawAmount = req.amount ?? req.maxAmountRequired
      let amountAtomic: bigint | null = null
      if (typeof rawAmount === 'string' && /^[0-9]+$/.test(rawAmount)) amountAtomic = BigInt(rawAmount)
      offers.push({
        x402Version: version,
        scheme: String(req.scheme ?? ''),
        network: toCaip2(String(req.network ?? '')),
        amountAtomic,
        asset: String(req.asset ?? ''),
        payTo: String(req.payTo ?? ''),
        raw: req,
      })
    }
  }
  return offers
}

export type OfferExpectations = {
  maxAmountAtomic: bigint
  allowedNetworks: string[] // CAIP-2
  /** Si fourni, l'asset doit matcher exactement ; sinon dérivé du réseau (USDC connu). */
  expectedAsset?: string
  expectedPayTo?: string
}

export type OfferCheck = { name: string; ok: boolean; detail: string }
export type OfferEvaluation = {
  decision: 'GO' | 'NO-GO'
  checks: OfferCheck[]
  selected: NormalizedOffer | null
}

/**
 * Évalue les offres observées contre des attentes strictes. Fail-closed :
 * aucune offre conforme → NO-GO. Ne signe rien, ne paie rien.
 */
export function evaluateOffers(offers: NormalizedOffer[], expect: OfferExpectations): OfferEvaluation {
  const checks: OfferCheck[] = []
  if (offers.length === 0) {
    return {
      decision: 'NO-GO',
      checks: [{ name: 'challenge-present', ok: false, detail: 'No x402 challenge (v1 body or v2 header) was found.' }],
      selected: null,
    }
  }
  checks.push({ name: 'challenge-present', ok: true, detail: `${offers.length} offer(s) observed.` })

  for (const offer of offers) {
    const local: OfferCheck[] = []
    const push = (name: string, ok: boolean, detail: string) => local.push({ name, ok, detail })

    push('scheme-exact', offer.scheme === 'exact', `scheme=${offer.scheme || '(missing)'}`)
    push(
      'network-allowed',
      expect.allowedNetworks.includes(offer.network),
      `network=${offer.network || '(missing)'} allowed=${expect.allowedNetworks.join(',')}`,
    )
    push(
      'price-within-ceiling',
      offer.amountAtomic !== null && offer.amountAtomic <= expect.maxAmountAtomic,
      `amount=${offer.amountAtomic ?? 'unparseable'} ceiling=${expect.maxAmountAtomic}`,
    )
    const expectedAsset =
      expect.expectedAsset ??
      (offer.network in USDC_NETWORKS ? USDC_NETWORKS[offer.network as UsdcNetworkId].usdc : null)
    push(
      'asset-is-expected-usdc',
      expectedAsset !== null && sameAddress(offer.asset, expectedAsset),
      `asset=${offer.asset || '(missing)'} expected=${expectedAsset ?? '(unknown network)'}`,
    )
    if (expect.expectedPayTo) {
      push(
        'recipient-matches-manifest',
        sameAddress(offer.payTo, expect.expectedPayTo),
        `payTo=${offer.payTo || '(missing)'} expected=${expect.expectedPayTo}`,
      )
    }

    if (local.every((c) => c.ok)) {
      return { decision: 'GO', checks: [...checks, ...local], selected: offer }
    }
    checks.push(...local)
  }
  return { decision: 'NO-GO', checks, selected: null }
}
