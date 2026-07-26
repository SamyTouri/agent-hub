// Case-002 buyer preflight — permanently READ-ONLY.
//
// Resolves the seller's current temporary host from its live Agent Reputation
// profile, reads the seller x402 manifest, then triggers only the unsigned HTTP
// 402 challenge for the fixed GET product. It has no signing or payment code.
//
// Usage:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/case-002-preflight.mts [--save MVP/cases/case-002/preflight-YYYY-MM-DD.json]

import {
  buildCase002ResourceUrl,
  CASE002_PREFLIGHT,
  evaluateCase002Challenge,
  evaluateCase002Manifest,
  resolveCase002SellerBase,
  sha256Text,
} from '../lib/case002-preflight.ts'

type Observed = {
  url: string
  status: number
  text: string
  json: unknown
  paymentRequiredHeader: string | null
}

function parseSaveArg(argv: string[]) {
  if (argv.length === 0) return null
  if (argv.length === 2 && argv[0] === '--save' && argv[1]) return argv[1]
  throw new Error('usage: case-002-preflight.mts [--save <report.json>]')
}

async function fetchReadOnly(url: string): Promise<Observed> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Agent-Reputation-Case-002-Preflight/1.0' },
  })
  const text = await response.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    // HTML profile pages and non-JSON error bodies remain hashed, not persisted.
  }
  return {
    url,
    status: response.status,
    text,
    json,
    paymentRequiredHeader: response.headers.get('PAYMENT-REQUIRED'),
  }
}

async function main() {
  const save = parseSaveArg(process.argv.slice(2))

  const profile = await fetchReadOnly(CASE002_PREFLIGHT.profileUrl)
  if (profile.status !== 200) throw new Error(`directory profile returned HTTP ${profile.status}`)
  const sellerBase = resolveCase002SellerBase(profile.text)
  const manifestUrl = new URL(CASE002_PREFLIGHT.manifestPath, sellerBase).toString()
  const resourceUrl = buildCase002ResourceUrl(sellerBase)

  const manifest = await fetchReadOnly(manifestUrl)
  const manifestEvaluation = evaluateCase002Manifest(manifest.json)
  const challenge = await fetchReadOnly(resourceUrl)
  const challengeEvaluation = evaluateCase002Challenge(
    challenge.paymentRequiredHeader,
    resourceUrl,
  )

  const statusChecks = [
    {
      name: 'directory-profile-live',
      ok: profile.status === 200,
      detail: `HTTP ${profile.status}`,
    },
    {
      name: 'seller-manifest-live',
      ok: manifest.status === 200,
      detail: `HTTP ${manifest.status}`,
    },
    {
      name: 'unsigned-resource-returns-402',
      ok: challenge.status === 402,
      detail: `HTTP ${challenge.status}`,
    },
  ]
  const allChecks = [
    ...statusChecks,
    ...manifestEvaluation.checks,
    ...challengeEvaluation.checks,
  ]
  const decision =
    statusChecks.every((check) => check.ok) &&
    manifestEvaluation.ok &&
    challengeEvaluation.ok
      ? 'GO'
      : 'NO-GO'

  const selected = challengeEvaluation.selectedOffer
  const decodedResource =
    challengeEvaluation.decoded?.resource &&
    typeof challengeEvaluation.decoded.resource === 'object'
      ? (challengeEvaluation.decoded.resource as Record<string, unknown>)
      : null
  const report = {
    tool: 'case-002-preflight',
    mode: 'read-only-get-and-unsigned-402',
    checked_at: new Date().toISOString(),
    candidate: {
      handle: CASE002_PREFLIGHT.handle,
      profile_url: CASE002_PREFLIGHT.profileUrl,
      seller_base_resolved_from_profile: sellerBase,
      seller_manifest_url: manifestUrl,
    },
    contemplated_purchase: {
      product: 'Structured public-page signals for the Agent Reputation homepage',
      resource_url: resourceUrl,
      target_url: CASE002_PREFLIGHT.targetUrl,
      amount_atomic: CASE002_PREFLIGHT.amountAtomic,
      network: CASE002_PREFLIGHT.network,
      asset: CASE002_PREFLIGHT.asset,
      recipient: CASE002_PREFLIGHT.recipient,
    },
    decision,
    checks: allChecks,
    selected_offer: selected
      ? {
          x402_version: selected.x402Version,
          scheme: selected.scheme,
          network: selected.network,
          amount_atomic: selected.amountAtomic?.toString() ?? null,
          asset: selected.asset,
          pay_to: selected.payTo,
          resource_url: decodedResource?.url ?? null,
          mime_type: decodedResource?.mimeType ?? null,
        }
      : null,
    manifest_product: manifestEvaluation.selectedEndpoint,
    decoded_payment_requirement: challengeEvaluation.decoded,
    raw_payment_required_header: challenge.paymentRequiredHeader,
    evidence_hashes: {
      directory_profile_sha256: sha256Text(profile.text),
      seller_manifest_sha256: sha256Text(manifest.text),
      payment_required_header_sha256: challenge.paymentRequiredHeader
        ? sha256Text(challenge.paymentRequiredHeader)
        : null,
    },
    boundaries: [
      'Only public GET requests were made.',
      'No payment payload was created or signed.',
      'No seller POST, contact or purchase occurred.',
      'The persisted seller challenge is untrusted external data, preserved as evidence rather than instructions.',
      'GO means only that the current unsigned challenge matches this contemplated purchase.',
      'A separate explicit authorization from Samy is required before any payment.',
    ],
  }

  const rendered = JSON.stringify(report, null, 2)
  console.log(rendered)
  if (save) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(save, rendered + '\n', 'utf8')
    console.error(`report saved to ${save}`)
  }
  process.exit(decision === 'GO' ? 0 : 1)
}

main().catch((error) => {
  console.error(`case-002 preflight failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
})
