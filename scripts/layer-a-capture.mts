// Couche A — capture datée des surfaces d'offres payantes, avec l'empreinte de leurs octets.
//
// POURQUOI CE FICHIER. Le module `lib/canonical-capture.ts` a été écrit et testé le
// 2026-07-31 mais rien ne l'appelait : un outil que personne n'exécute n'observe rien, et
// laisser croire le contraire serait exactement la faute qu'on reproche aux autres. Ceci est
// l'appelant.
//
// CE QU'IL FAIT. Il relit le corpus d'offres payantes du 30/07, interroge chaque surface en
// LECTURE SEULE et sans payer, et écrit une ligne par surface dans le carnet d'observations —
// avec l'empreinte SHA-256 des octets exacts, les validateurs HTTP du serveur, et le degré de
// vérification `observed`, jamais mieux.
//
// CE QU'IL N'EST PAS. Ce n'est pas une preuve qu'une promesse a été rompue. Une empreinte qui
// change dit que la ressource servie n'est plus la même, pas qu'un vendeur a menti. Le verdict
// reste celui de `compareCaptures`, volontairement faible.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/layer-a-capture.mts [--dry-run]

import { appendFile, mkdir } from 'node:fs/promises'
import { canonicalCaptureFacts, captureCanonicalResponse } from '../lib/canonical-capture.ts'

/**
 * Les surfaces du corpus qui exposent une adresse interrogeable. Recopiées depuis
 * `docs/layer-a-x402-corpus-2026-07-30.md`, qui reste la source citable ; ici on ne garde que
 * ce qui est nécessaire pour aller regarder. Une entrée sans surface n'y figure pas plutôt que
 * d'y figurer vide.
 */
const SURFACES: Array<{ seller: string; url: string; announced_terms: string }> = [
  { seller: 'satoshi_ln', url: 'https://dispatches.mystere.me', announced_terms: '$0.001/call (x402); 10 sats/call (L402)' },
  { seller: 'tiamat-entity', url: 'https://the-service.live', announced_terms: '$0.005-0.01/call, 5 endpoints' },
  { seller: 'merc-registry', url: 'https://march-madness-sim.vercel.app', announced_terms: '$0.02 / $0.08 / $0.15 / $0.35 by tier' },
  { seller: 'WesleyCashBot', url: 'https://synthai.online/intel/ai-pulse', announced_terms: '$0.03/request, Dutch auction, then free at floor' },
  { seller: 'TheTarotOracle', url: 'https://api-proxy-x402.guillermo-857.workers.dev', announced_terms: '$0.05 / $0.005 / $0.03 / $0.002 by route' },
  { seller: 'integrity_molt', url: 'https://185-227-111-100.nip.io', announced_terms: '0.01 USDC/call; 0.50 USDC/call deep audit' },
  { seller: 'globalchat', url: 'https://global-chat.io', announced_terms: '0.10 USDC/call on /api/feeds/directory' },
  { seller: 'quillagent', url: 'https://wasiai.io', announced_terms: '$0.01/call, signed receipt valid 24h' },
  { seller: 'hypergrowth', url: 'https://hyper-growth.xyz', announced_terms: 'live buyer test, buy route published' },
  // La ligne qui a motivé toute la couche A : décrite en mars comme librement consultable,
  // elle exigeait un paiement le 30/07 sur la même route. C'est aussi celle proposée à
  // rushabdev pour l'expérience croisée.
  { seller: 'ClawGig', url: 'https://clawgig.ai/api/v1/gigs', announced_terms: 'catalogue described in March as browsable without auth; 402 challenge on 2026-07-30' },
]

const NOTEBOOK_DIR = 'observations'

function notebookPath(now: Date): string {
  return `${NOTEBOOK_DIR}/${now.toISOString().slice(0, 7)}.jsonl`
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const now = new Date()
  const lines: string[] = []

  for (const surface of SURFACES) {
    const capture = await captureCanonicalResponse(surface.url)
    const facts = canonicalCaptureFacts(capture)
    const observation = {
      id: `layer-a-${now.toISOString().slice(0, 10)}-${surface.seller.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      observed_at: capture.observed_at,
      kind: 'paid_offer_surface',
      // `observed` et pas mieux : on a regardé nous-mêmes et un tiers peut refaire la
      // requête, mais personne n'a signé quoi que ce soit. Le carnet interdit de monter
      // au-dessus sans signature.
      trust: 'observed',
      subject: { seller_as_published: surface.seller, url: surface.url },
      announced_terms_as_published: surface.announced_terms,
      source: 'docs/layer-a-x402-corpus-2026-07-30.md',
      facts,
      method:
        'GET, read-only, no payment and no authentication. The digest covers the exact bytes returned; a failed capture is recorded with its reason.',
    }
    const line = JSON.stringify(observation)
    lines.push(line)
    const state = capture.capture_failure ?? `${capture.http_status} ${capture.body_sha256?.slice(0, 12) ?? ''}`
    console.log(`${surface.seller.padEnd(24)} ${state}`)
  }

  if (dryRun) {
    console.log(`\ndry run: ${lines.length} observation(s) built, nothing written.`)
    return
  }

  await mkdir(NOTEBOOK_DIR, { recursive: true })
  const path = notebookPath(now)
  await appendFile(path, `${lines.join('\n')}\n`, 'utf8')
  console.log(`\n${lines.length} observation(s) appended to ${path}`)
  console.log('Append-only: a correction is a NEW line citing the id above, never an edit.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
