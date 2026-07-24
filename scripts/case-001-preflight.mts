// Outil acheteur Case-001 — préflight x402 en LECTURE SEULE par défaut.
//
// Vérifie, sans rien signer ni dépenser, que l'offre du vendeur correspond
// toujours aux attentes documentées dans MVP/cases/case-001/ : endpoint,
// scheme exact, réseau, asset USDC, prix <= 1 USDC, destinataire déclaré.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/case-001-preflight.mts [options]
//
// Modes :
//   (défaut)      GET manifest + GET/inspection du challenge de paiement. Aucun POST
//                 vers l'endpoint de commande (dossier M-007 : pas d'état créé chez
//                 le vendeur avant autorisation).
//   --probe-post  POST d'intake SANS paiement (crée un état côté vendeur — opt-in).
//                 Exige CASE001_DELIVERY_CONTACT dans l'environnement (jamais en repo).
//   --save <f>    écrit le rapport JSON d'évidence dans <f>.
//   --endpoint / --manifest / --payment-url / --recipient / --max-usdc / --network
//                 remplacent les valeurs par défaut du cas.
//
// Exécution réelle : volontairement absente de CET outil de lecture seule.
// `scripts/case-001-pay.mts` est le client séparé, plus fortement gaté, fondé sur
// le wallet CDP et le SDK x402 officiels. --execute reste ici comme piège
// fail-closed pour les anciens modes d'emploi. Voir MVP/x402-payment-setup.md.

import { evaluateOffers, normalizeChallenges, type NormalizedOffer } from '../lib/x402.ts'

// Attentes par défaut = état documenté du dossier Case-001 (2026-07-22).
const DEFAULTS = {
  endpoint: 'https://transform-balanced-trunk-remedies.trycloudflare.com/v1/homepage-hero-order',
  manifest: 'https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/x402',
  paymentUrl: 'https://payanagent.com/x402/kh77taf99avt46753np9b0ktjn8azhsy',
  recipient: '0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E',
  maxUsdc: '1',
  network: 'eip155:8453',
}

type Args = {
  endpoint: string
  manifest: string
  paymentUrl: string
  recipient: string
  maxUsdc: string
  network: string
  probePost: boolean
  execute: boolean
  authorizeFlag: boolean
  save: string | null
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    endpoint: DEFAULTS.endpoint,
    manifest: DEFAULTS.manifest,
    paymentUrl: DEFAULTS.paymentUrl,
    recipient: DEFAULTS.recipient,
    maxUsdc: DEFAULTS.maxUsdc,
    network: DEFAULTS.network,
    probePost: false,
    execute: false,
    authorizeFlag: false,
    save: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      i += 1
      if (i >= argv.length) throw new Error(`missing value for ${arg}`)
      return argv[i]
    }
    if (arg === '--endpoint') out.endpoint = next()
    else if (arg === '--manifest') out.manifest = next()
    else if (arg === '--payment-url') out.paymentUrl = next()
    else if (arg === '--recipient') out.recipient = next()
    else if (arg === '--max-usdc') out.maxUsdc = next()
    else if (arg === '--network') out.network = next()
    else if (arg === '--probe-post') out.probePost = true
    else if (arg === '--execute') out.execute = true
    else if (arg === '--i-authorize-spending') out.authorizeFlag = true
    else if (arg === '--save') out.save = next()
    else throw new Error(`unknown argument: ${arg}`)
  }
  return out
}

function usdcToAtomic(usdc: string): bigint {
  if (!/^[0-9]+(\.[0-9]{1,6})?$/.test(usdc)) throw new Error(`invalid USDC amount: ${usdc}`)
  const [whole, frac = ''] = usdc.split('.')
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0'))
}

async function fetchObserved(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), redirect: 'follow' })
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    /* réponse non-JSON : conservée en texte */
  }
  return { url, status: res.status, paymentRequiredHeader: res.headers.get('PAYMENT-REQUIRED'), body, text }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.execute) {
    if (!args.authorizeFlag || process.env.CASE001_EXECUTE !== 'I-AUTHORIZE-A-REAL-PAYMENT') {
      console.error(
        'REFUSED: --execute requires BOTH --i-authorize-spending and CASE001_EXECUTE=I-AUTHORIZE-A-REAL-PAYMENT in the environment.',
      )
      process.exit(3)
    }
    console.error(
      [
        'REFUSED BY DESIGN: case-001-preflight is permanently read-only and cannot spend.',
        'The separately gated official-SDK buyer is scripts/case-001-pay.mts.',
        'Use it only after a new explicit authorization from Samy tied to the exact 1-USDC',
        'Case-001 transaction. See MVP/x402-payment-setup.md, buyer section.',
      ].join('\n'),
    )
    process.exit(3)
  }

  const maxAtomic = usdcToAtomic(args.maxUsdc)
  const observations: Array<Awaited<ReturnType<typeof fetchObserved>>> = []
  const offers: NormalizedOffer[] = []
  const notes: string[] = []

  // 1. Manifest vendeur (lecture seule).
  try {
    const manifest = await fetchObserved(args.manifest)
    observations.push(manifest)
    offers.push(...normalizeChallenges({ body: manifest.body }))
    const declaresRecipient = manifest.text.toLowerCase().includes(args.recipient.toLowerCase())
    notes.push(
      declaresRecipient
        ? `manifest still declares expected recipient ${args.recipient}`
        : `WARNING: manifest no longer contains expected recipient ${args.recipient}`,
    )
  } catch (e) {
    notes.push(`manifest unreachable: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. Challenge de paiement observable en GET (PayanAgent renvoie 402 en lecture).
  try {
    const challenge = await fetchObserved(args.paymentUrl)
    observations.push(challenge)
    offers.push(...normalizeChallenges({ paymentRequiredHeader: challenge.paymentRequiredHeader, body: challenge.body }))
    if (challenge.status !== 402) notes.push(`payment URL returned ${challenge.status} (expected 402)`)
  } catch (e) {
    notes.push(`payment URL unreachable: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3. POST d'intake sans paiement — UNIQUEMENT sur opt-in explicite (crée de
  //    l'état côté vendeur ; le dossier M-007 l'interdit avant autorisation).
  if (args.probePost) {
    const contact = process.env.CASE001_DELIVERY_CONTACT
    if (!contact) {
      console.error('REFUSED: --probe-post requires CASE001_DELIVERY_CONTACT in the environment (never committed).')
      process.exit(2)
    }
    const probe = await fetchObserved(args.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://agentreputation.dev/',
        primaryBuyer: 'Autonomous agents and their human operators deciding whether to buy a service from an AI agent.',
        offer: 'Independent, source-linked evidence dossiers and manual pre-purchase decision analysis.',
        desiredAction: 'Bring one real contemplated purchase to Agent Reputation for a manual pre-purchase review.',
        replyTo: contact,
      }),
    })
    // Le contact privé ne doit jamais apparaître dans le rapport.
    probe.text = probe.text.split(contact).join('[private-contact]')
    observations.push(probe)
    offers.push(...normalizeChallenges({ paymentRequiredHeader: probe.paymentRequiredHeader, body: probe.body }))
    if (probe.status !== 402) notes.push(`order endpoint returned ${probe.status} on unpaid POST (expected 402)`)
  } else {
    notes.push('order endpoint NOT probed (default read-only mode; use --probe-post to opt in)')
  }

  const evaluation = evaluateOffers(offers, {
    maxAmountAtomic: maxAtomic,
    allowedNetworks: [args.network],
    expectedPayTo: args.recipient,
  })

  const report = {
    tool: 'case-001-preflight',
    mode: args.probePost ? 'probe-post' : 'read-only',
    checked_at: new Date().toISOString(),
    expectations: {
      endpoint: args.endpoint,
      max_price_atomic: maxAtomic.toString(),
      network: args.network,
      recipient: args.recipient,
    },
    decision: evaluation.decision,
    checks: evaluation.checks,
    selected_offer: evaluation.selected
      ? { ...evaluation.selected, amountAtomic: evaluation.selected.amountAtomic?.toString() ?? null }
      : null,
    notes,
    observations: observations.map((o) => ({
      url: o.url,
      status: o.status,
      payment_required_header_present: Boolean(o.paymentRequiredHeader),
      body_excerpt: o.text.slice(0, 2000),
    })),
    reminder:
      'GO means only: the observed offer still matches the documented expectations. It does NOT authorize a payment. A real payment requires a separate explicit authorization from Samy in the same session.',
  }

  const rendered = JSON.stringify(report, null, 2)
  console.log(rendered)
  if (args.save) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(args.save, rendered + '\n', 'utf8')
    console.error(`report saved to ${args.save}`)
  }
  process.exit(evaluation.decision === 'GO' ? 0 : 1)
}

main().catch((e) => {
  console.error(`preflight failed: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(2)
})
