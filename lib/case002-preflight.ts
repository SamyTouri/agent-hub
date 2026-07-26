import { createHash } from 'node:crypto'

import { decodeBase64Json, evaluateOffers, normalizeChallenges, USDC_NETWORKS } from './x402.ts'

export const CASE002_PREFLIGHT = {
  handle: 'homepage-rewrite-agent-base-usdc',
  profileUrl: 'https://agentreputation.dev/agents/homepage-rewrite-agent-base-usdc',
  targetUrl: 'https://agentreputation.dev/',
  productPath: '/v1/page-signals',
  manifestPath: '/.well-known/x402',
  network: 'eip155:8453',
  asset: USDC_NETWORKS['eip155:8453'].usdc,
  recipient: '0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E',
  amountAtomic: '50000',
  advertisedPrice: '$0.05',
} as const

export type PreflightCheck = {
  name: string
  ok: boolean
  detail: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function sameAddress(left: string, right: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(left) &&
    /^0x[a-fA-F0-9]{40}$/.test(right) &&
    left.toLowerCase() === right.toLowerCase()
}

export function sha256Text(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/**
 * Case-002 deliberately resolves the seller from the live directory profile.
 * A stored tunnel URL is evidence history, never a current routing instruction.
 */
export function resolveCase002SellerBase(profileHtml: string) {
  const candidates = [
    ...new Set(
      [...profileHtml.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi)].map(
        (match) => new URL(match[0]).origin,
      ),
    ),
  ]
  if (candidates.length !== 1) {
    throw new Error(`expected exactly one current trycloudflare seller host, found ${candidates.length}`)
  }

  const url = new URL(candidates[0])
  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error('directory profile returned an unsafe seller endpoint')
  }
  return url.origin
}

export function buildCase002ResourceUrl(sellerBase: string) {
  const resource = new URL(CASE002_PREFLIGHT.productPath, sellerBase)
  resource.searchParams.set('url', CASE002_PREFLIGHT.targetUrl)
  return resource.toString()
}

export function evaluateCase002Manifest(manifest: unknown): {
  ok: boolean
  checks: PreflightCheck[]
  selectedEndpoint: Record<string, unknown> | null
} {
  const record = asRecord(manifest)
  const endpoints = Array.isArray(record?.endpoints)
    ? record.endpoints.map(asRecord).filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : []
  const selected =
    endpoints.find(
      (entry) =>
        entry.path === CASE002_PREFLIGHT.productPath &&
        String(entry.method ?? '').toUpperCase() === 'GET',
    ) ?? null

  const checks: PreflightCheck[] = [
    {
      name: 'manifest-readable',
      ok: Boolean(record),
      detail: record ? 'seller x402 manifest is JSON' : 'seller x402 manifest is not a JSON object',
    },
    {
      name: 'product-declared',
      ok: Boolean(selected),
      detail: selected
        ? `${String(selected.method).toUpperCase()} ${String(selected.path)}`
        : `${CASE002_PREFLIGHT.productPath} GET is absent`,
    },
    {
      name: 'advertised-price-exact',
      ok: selected?.price === CASE002_PREFLIGHT.advertisedPrice,
      detail: `price=${String(selected?.price ?? '(missing)')} expected=${CASE002_PREFLIGHT.advertisedPrice}`,
    },
    {
      name: 'manifest-recipient-continuity',
      ok: sameAddress(String(record?.payTo ?? ''), CASE002_PREFLIGHT.recipient),
      detail: `payTo=${String(record?.payTo ?? '(missing)')} expected=${CASE002_PREFLIGHT.recipient}`,
    },
  ]

  return { ok: checks.every((check) => check.ok), checks, selectedEndpoint: selected }
}

function decodePaymentRequiredHeader(value: string): Record<string, unknown> {
  // Même décodeur (base64 strict, borné en taille) que `normalizeChallenges`, pour
  // que le challenge décodé ici et les offres normalisées ne puissent jamais diverger :
  // un décodeur local plus permissif (base64url) accepterait un en-tête que la voie
  // des offres rejette, produisant un rapport « décodé mais aucune offre » trompeur.
  const parsed = decodeBase64Json(value)
  const record = asRecord(parsed)
  if (!record) throw new Error('PAYMENT-REQUIRED did not decode to a JSON object')
  return record
}

export function evaluateCase002Challenge(
  paymentRequiredHeader: string | null,
  expectedResourceUrl: string,
): {
  ok: boolean
  checks: PreflightCheck[]
  selectedOffer: ReturnType<typeof normalizeChallenges>[number] | null
  decoded: Record<string, unknown> | null
} {
  if (!paymentRequiredHeader) {
    return {
      ok: false,
      checks: [{ name: 'payment-required-header', ok: false, detail: 'header is missing' }],
      selectedOffer: null,
      decoded: null,
    }
  }

  let decoded: Record<string, unknown>
  try {
    decoded = decodePaymentRequiredHeader(paymentRequiredHeader)
  } catch (error) {
    return {
      ok: false,
      checks: [
        {
          name: 'payment-required-header',
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
      selectedOffer: null,
      decoded: null,
    }
  }

  const offers = normalizeChallenges({ paymentRequiredHeader })
  const evaluation = evaluateOffers(offers, {
    maxAmountAtomic: BigInt(CASE002_PREFLIGHT.amountAtomic),
    allowedNetworks: [CASE002_PREFLIGHT.network],
    expectedAsset: CASE002_PREFLIGHT.asset,
    expectedPayTo: CASE002_PREFLIGHT.recipient,
  })
  const resource = asRecord(decoded.resource)
  const selected = evaluation.selected
  const checks: PreflightCheck[] = [
    ...evaluation.checks,
    {
      name: 'x402-version-2',
      ok: decoded.x402Version === 2,
      detail: `x402Version=${String(decoded.x402Version ?? '(missing)')}`,
    },
    {
      name: 'price-exact',
      ok: selected?.amountAtomic === BigInt(CASE002_PREFLIGHT.amountAtomic),
      detail: `amount=${selected?.amountAtomic ?? '(missing)'} expected=${CASE002_PREFLIGHT.amountAtomic}`,
    },
    {
      name: 'resource-bound-to-request',
      ok: resource?.url === expectedResourceUrl,
      detail: `resource=${String(resource?.url ?? '(missing)')} expected=${expectedResourceUrl}`,
    },
  ]

  return {
    ok: evaluation.decision === 'GO' && checks.every((check) => check.ok),
    checks,
    selectedOffer: selected,
    decoded,
  }
}
