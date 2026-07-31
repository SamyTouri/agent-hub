// Empreinte des OCTETS servis, à côté de l'empreinte de notre lecture.
//
// POURQUOI. La couche A conserve aujourd'hui des faits normalisés plus l'empreinte de leur
// forme normalisée. C'est suffisant pour DÉTECTER qu'un terme commercial a changé, et
// insuffisant pour le PROUVER à quelqu'un qui ne nous croit pas : reconstituer notre
// empreinte exige notre normaliseur, donc notre parole. Un opérateur nous l'a posé
// frontalement le 2026-07-31 : « does your dated commercial memory preserve canonical
// response bytes plus an independent timestamp, or normalized claims only — and what verdict
// does a post-payment byte divergence produce? » La réponse honnête était : des données
// normalisées. Ce module comble la moitié bon marché de l'écart.
//
// CE QUI EST AJOUTÉ, ET CE QUI NE L'EST PAS. On garde l'empreinte SHA-256 des octets exacts
// reçus, leur nombre, le type déclaré, et les validateurs HTTP que le serveur nous donne
// (ETag, Last-Modified, Date). On ne garde PAS la page : la règle « les pages amont ne sont
// jamais stockées » ne bouge pas, et une empreinte tient en soixante-quatre caractères.
//
// CE QUE ÇA NE RÉSOUT PAS, ET IL FAUT LE DIRE. Une empreinte prouve la divergence à qui
// détient les octets d'origine ; elle ne les lui fournit pas. Tant qu'un tiers indépendant
// ne les archive pas et ne les horodate pas, notre observation reste datée par nous seuls.
// C'est la moitié chère, délibérément remise à plus tard, et ce module ne prétend pas
// l'avoir faite.
//
// PORTÉE. Réservé aux surfaces dont on suit les TERMES COMMERCIAUX — les offres payantes.
// La flotte de sondage, elle, ne lit jamais un corps de réponse : lui faire télécharger des
// milliers de pages pour une empreinte coûterait de la bande passante sans rien apprendre,
// puisqu'on n'y suit pas de promesse commerciale.

import { createHash } from 'node:crypto'

/** Plafond de lecture. Au-delà, on préfère ne pas empreindre plutôt que d'avaler une page
 *  géante : une empreinte partielle serait fausse en silence, ce qui est pire que rien. */
export const MAX_CAPTURE_BYTES = 2_000_000

export type CanonicalCapture = {
  /** Toujours présent : l'observation a eu lieu, même ratée. */
  observed_at: string
  url: string
  /** Absent si l'hôte n'a pas répondu. */
  http_status?: number
  /** SHA-256 des octets EXACTS reçus. Absent si le corps n'a pas pu être lu en entier. */
  body_sha256?: string
  /** Nombre d'octets réellement lus. */
  body_bytes?: number
  content_type?: string
  /** Validateurs HTTP servis par l'hôte : ils datent la ressource sans nous. */
  etag?: string
  last_modified?: string
  /** En-tête `Date` du serveur : un horodatage qui ne vient pas de notre horloge. */
  server_date?: string
  /** Renseigné quand la capture a échoué. Une absence d'empreinte n'est JAMAIS silencieuse. */
  capture_failure?: 'no_response' | 'too_large' | 'read_error'
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Verdict d'une divergence entre deux captures de la même adresse.
 *
 * Trois cas, et le troisième est celui qui compte. Des octets identiques ne prouvent RIEN
 * sur le fond — un serveur peut resservir la même page en ayant changé d'avis ailleurs.
 * Des octets différents ne prouvent pas non plus une rupture de promesse : une date, un
 * jeton de session ou un compteur suffisent à changer l'empreinte. Ce que la divergence
 * établit, et c'est déjà beaucoup, c'est que **la ressource servie n'est plus celle qui
 * était servie au moment du paiement** — donc que la version invoquée par le vendeur
 * aujourd'hui n'est pas celle que l'acheteur a payée.
 */
export type DivergenceVerdict =
  | { kind: 'identical'; note: string }
  | { kind: 'diverged'; note: string }
  | { kind: 'undecidable'; note: string }

export function compareCaptures(atPayment: CanonicalCapture, now: CanonicalCapture): DivergenceVerdict {
  if (!atPayment.body_sha256 || !now.body_sha256) {
    return {
      kind: 'undecidable',
      note:
        'One of the two captures has no byte digest, so nothing is compared. An unreadable capture is not a match and not a divergence.',
    }
  }
  if (atPayment.body_sha256 === now.body_sha256) {
    return {
      kind: 'identical',
      note:
        'The exact same bytes are served. This says the published page has not moved; it says nothing about whether the promise was kept.',
    }
  }
  return {
    kind: 'diverged',
    note:
      'The resource served today is not the one served when the payment settled. This does not by itself prove a broken promise — a date or a counter changes the digest too — but the version the seller invokes today is not the version the buyer paid against.',
  }
}

/**
 * Capture en LECTURE SEULE. Aucune exception ne remonte : comme la sonde, une capture qui
 * casse ne doit pas casser un traitement par lot. Un échec est rendu comme un fait, pas
 * comme une absence.
 */
export async function captureCanonicalResponse(
  url: string,
  options: { timeoutMs?: number; now?: () => Date; fetchImpl?: typeof fetch } = {},
): Promise<CanonicalCapture> {
  const now = options.now ?? (() => new Date())
  const doFetch = options.fetchImpl ?? fetch
  const base: CanonicalCapture = { observed_at: now().toISOString(), url }

  let response: Response
  try {
    response = await doFetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      headers: { 'user-agent': 'AgentReputationBot/1.0 (+https://agentreputation.dev)' },
    })
  } catch {
    return { ...base, capture_failure: 'no_response' }
  }

  const header = (name: string) => response.headers.get(name) ?? undefined
  const withHeaders: CanonicalCapture = {
    ...base,
    http_status: response.status,
    content_type: header('content-type'),
    etag: header('etag'),
    last_modified: header('last-modified'),
    server_date: header('date'),
  }

  // Le plafond est contrôlé sur les octets RÉELLEMENT lus, pas sur `content-length` :
  // cet en-tête est déclaratif et peut mentir, et c'est précisément ce genre de confiance
  // qu'on refuse ailleurs.
  try {
    const buffer = new Uint8Array(await response.arrayBuffer())
    if (buffer.byteLength > MAX_CAPTURE_BYTES) {
      return { ...withHeaders, body_bytes: buffer.byteLength, capture_failure: 'too_large' }
    }
    return { ...withHeaders, body_bytes: buffer.byteLength, body_sha256: sha256Hex(buffer) }
  } catch {
    return { ...withHeaders, capture_failure: 'read_error' }
  }
}

/**
 * Faits d'une observation de termes commerciaux, prêts à entrer dans l'historique.
 *
 * `observed_at` et `server_date` sont VOLONTAIREMENT exclus des faits : l'historique
 * n'écrit une ligne que lorsque l'empreinte des faits change, et y mettre une horloge
 * réintroduirait une ligne par passage. Les horodatages vivent sur la ligne d'observation,
 * pas dans ce qui est empreint.
 */
export function canonicalCaptureFacts(capture: CanonicalCapture): Record<string, string | number> {
  const facts: Record<string, string | number> = { url: capture.url }
  if (capture.http_status !== undefined) facts.http_status = capture.http_status
  if (capture.body_sha256) facts.body_sha256 = capture.body_sha256
  if (capture.body_bytes !== undefined) facts.body_bytes = capture.body_bytes
  if (capture.content_type) facts.content_type = capture.content_type
  if (capture.etag) facts.etag = capture.etag
  if (capture.last_modified) facts.last_modified = capture.last_modified
  if (capture.capture_failure) facts.capture_failure = capture.capture_failure
  return facts
}
