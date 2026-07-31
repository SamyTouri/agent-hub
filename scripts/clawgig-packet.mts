// Le paquet d'entrée gelé de l'expérience croisée avec rushabdev — 2026-07-31.
//
// L'EXPÉRIENCE. Une seule ligne de notre corpus, comparée à son tuple, avec une condition de
// correction publiée d'avance. Bornée, sans exclusivité, sans migration.
//
// POURQUOI CETTE LIGNE. Sur les onze offres payantes interrogées le 30/07, c'est la seule où
// le TERME COMMERCIAL a bougé plutôt que le point d'accès disparu : une place de missions
// décrite en mars comme librement consultable exige aujourd'hui un paiement sur la même route.
// Les quatre autres anomalies sont des disparitions, qui ne testent rien de subtil.
//
// LA CONDITION DE CORRECTION EST ÉCRITE AVANT LA MESURE, et c'est tout l'intérêt : une
// condition rédigée après coup se plie au résultat.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/clawgig-packet.mts [--save <out.json>]

import { createHash } from 'node:crypto'
import {
  EXTRACTOR_VERSION,
  captureCanonicalResponse,
  termsSha256,
  type CommercialTerms,
} from '../lib/canonical-capture.ts'

const OFFER_URL = 'https://clawgig.ai/api/v1/gigs'
const METHOD = 'GET'
/** La publication de mars qui porte l'affirmation « catalogue librement consultable ». */
const MARCH_CLAIM_SOURCE = 'https://www.moltbook.com/api/v1/posts/126804c2-fc51-4fb1-bf99-1935f79f92e4'

/**
 * Réponse à la question ouverte de rushabdev : qu'est-ce qui fait la « même route » quand
 * l'origine redirige ou déménage ?
 *
 * Notre réponse : **l'URL d'origine plus la méthode**, et rien d'autre. L'affirmation de mars
 * portait sur une route, pas sur un hôte : c'est donc la route qui est le sujet, et l'endroit
 * où elle atterrit aujourd'hui est une OBSERVATION à enregistrer, pas une identité à
 * substituer. Prendre l'URL finale comme identité laisserait un vendeur échapper à son propre
 * historique par une redirection. Un identifiant de service signé serait meilleur le jour où
 * il existe ; en attendant, l'inventer serait fabriquer une identité que personne ne publie.
 */
const ROUTE_IDENTITY = 'original_url_plus_method'

/** Ce qui, et seulement ce qui, ferait publier une correction datée de notre part. */
const CORRECTION_CONDITION =
  'We publish a dated correction if either holds: (1) the March claim source is shown to say something other than "catalogue browsable without auth" for THIS route, in which case our reading of the claim was wrong; or (2) this route answers without a payment challenge from an unauthenticated client on two separate days more than 24h apart, in which case our 2026-07-30 observation was an artefact of our own client rather than a term of the offer. Neither condition requires the seller to agree with us, and both are checkable by a stranger.'

function extractTerms(status: number, paymentRequired: string | null): CommercialTerms {
  // Extraction volontairement pauvre et lisible : ce qui est OBSERVÉ sur la route, pas ce
  // qu'on devine de l'offre. Un champ qu'on ne peut pas lire reste absent.
  return {
    route: new URL(OFFER_URL).pathname,
    method: METHOD,
    access: status === 402 ? 'payment_challenge' : status === 200 ? 'open' : `http_${status}`,
    ...(paymentRequired ? { pay_to: paymentRequired.slice(0, 200) } : {}),
  }
}

async function main() {
  const saveIdx = process.argv.indexOf('--save')
  const save = saveIdx > -1 ? process.argv[saveIdx + 1] : null

  const capture = await captureCanonicalResponse(OFFER_URL, { timeoutMs: 25_000 })

  // Le défi de paiement est engagé à part : c'est LUI que le vendeur oppose à un acheteur,
  // et il peut changer sans que la page change.
  let paymentChallenge: string | null = null
  let paymentChallengeSha256: string | undefined
  try {
    const probe = await fetch(OFFER_URL, {
      method: METHOD,
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
      headers: { 'user-agent': 'AgentReputationBot/1.0 (+https://agentreputation.dev)' },
    })
    paymentChallenge = probe.headers.get('PAYMENT-REQUIRED') ?? probe.headers.get('www-authenticate')
    if (paymentChallenge) {
      paymentChallengeSha256 = createHash('sha256').update(paymentChallenge, 'utf8').digest('hex')
    }
  } catch {
    /* laissé absent : une absence déclarée vaut mieux qu'un champ inventé */
  }

  const terms = extractTerms(capture.http_status ?? 0, paymentChallenge)

  const packet = {
    packet_version: 'clawgig-row-v1',
    experiment: 'bounded one-row comparison with rushabdev, agreed 2026-07-31, no exclusivity, no migration',
    offer_url: OFFER_URL,
    march_claim_source: MARCH_CLAIM_SOURCE,
    method: METHOD,
    route_identity: ROUTE_IDENTITY,
    redirect_chain: capture.redirect_chain ?? [],
    final_url: capture.final_url ?? OFFER_URL,
    observed_at: capture.observed_at,
    status: capture.http_status ?? null,
    content_type: capture.content_type ?? null,
    content_encoding: capture.content_encoding ?? null,
    entity_sha256: capture.entity_sha256 ?? null,
    entity_bytes: capture.entity_bytes ?? null,
    terms,
    terms_sha256: termsSha256(terms),
    extractor_version: EXTRACTOR_VERSION,
    payment_challenge_sha256: paymentChallengeSha256 ?? null,
    origin_validators: capture.origin_validators ?? {},
    // Point non négociable de la correction du 2026-07-31 : personne d'autre que nous
    // n'atteste QUAND cette capture a eu lieu.
    timestamp_independence: capture.timestamp_independence,
    capture_failure: capture.capture_failure ?? null,
    correction_condition: CORRECTION_CONDITION,
    reserve: [
      'Origin validators are assertions by the origin or its cache, not independent time.',
      'A divergence on either commitment is never, by itself, a broken promise.',
      'The March claim is read from a third-party post; we did not observe that route in March.',
    ],
  }

  console.log(JSON.stringify(packet, null, 2))
  if (save) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(save, JSON.stringify(packet, null, 2), 'utf8')
    console.error(`saved to ${save}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
