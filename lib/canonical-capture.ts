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

/**
 * Validateurs servis par l'origine. **Ce ne sont PAS des horodatages indépendants**, et le nom
 * du champ existe pour empêcher cette confusion. Corrigé le 2026-07-31 sur objection de
 * rushabdev : `Date`, `ETag` et `Last-Modified` sont des assertions de l'origine ou de son
 * cache, donc du même auteur que la page qu'ils prétendent dater. Une première version les
 * appelait « validateurs qui datent la ressource sans nous », ce qui était faux.
 */
export type OriginValidators = {
  etag?: string
  last_modified?: string
  /** En-tête `Date` du serveur. Assertion de l'origine, pas une preuve de temps. */
  date?: string
}

/**
 * Y a-t-il un tiers qui atteste QUAND cette capture a eu lieu ? Aujourd'hui, non : nous
 * sommes seuls à dater notre propre observation. Le champ reste explicite plutôt qu'absent,
 * pour qu'un lecteur ne prenne jamais notre horloge pour une preuve. Il passera à
 * `COMMITTED` le jour où un second observateur, un journal de transparence en ajout seul ou
 * une autorité d'horodatage engagera l'empreinte de la capture.
 */
export type TimestampIndependence = 'UNKNOWN' | 'COMMITTED'

export type CanonicalCapture = {
  /** Toujours présent : l'observation a eu lieu, même ratée. Notre horloge, et rien d'autre. */
  observed_at: string
  url: string
  /** Chaîne de redirections réellement suivie, première URL exclue. */
  redirect_chain?: string[]
  /** URL finalement servie, si elle diffère de celle demandée. */
  final_url?: string
  /** Absent si l'hôte n'a pas répondu. */
  http_status?: number
  /**
   * SHA-256 des octets EXACTS de l'entité reçue. Renommé depuis `body_sha256` le 2026-07-31 :
   * il y a désormais DEUX engagements distincts, et les confondre était le risque.
   */
  entity_sha256?: string
  /** Nombre d'octets réellement lus. */
  entity_bytes?: number
  content_type?: string
  content_encoding?: string
  origin_validators?: OriginValidators
  timestamp_independence: TimestampIndependence
  /** Renseigné quand la capture a échoué. Une absence d'empreinte n'est JAMAIS silencieuse. */
  capture_failure?: 'no_response' | 'too_large' | 'read_error'
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Le tuple commercial canonique : ce qu'une offre ANNONCE, extrait des octets et normalisé.
 *
 * Séparer cette empreinte de celle des octets est l'apport de rushabdev, 2026-07-31. Avec un
 * seul engagement, une page qui change d'habillage et une page qui change de prix rendent le
 * même verdict, ce qui rend le verdict inutilisable. Avec deux, on distingue les deux — et on
 * distingue aussi le cas où c'est NOTRE extracteur qui a bougé, qui était jusqu'ici invisible.
 *
 * `EXTRACTOR_VERSION` monte dès que la normalisation change de sens. Sans elle, deux mesures
 * prises par deux lentilles différentes seraient comparées comme si c'était la même.
 */
export const EXTRACTOR_VERSION = 'terms-v1'

export type CommercialTerms = {
  price?: string
  asset?: string
  network?: string
  pay_to?: string
  route?: string
  method?: string
  /** Ce que la surface exige pour répondre : `payment_challenge`, `open`, `auth`, `absent`. */
  access?: string
}

/** Empreinte du tuple commercial, extracteur inclus dans le hachage. */
export function termsSha256(terms: CommercialTerms): string {
  const ordered = Object.keys(terms)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      const v = (terms as Record<string, string | undefined>)[k]
      if (v !== undefined && v !== '') acc[k] = v
      return acc
    }, {})
  return createHash('sha256')
    .update(JSON.stringify({ extractor: EXTRACTOR_VERSION, terms: ordered }), 'utf8')
    .digest('hex')
}

/**
 * Verdict à QUATRE branches, sur deux engagements indépendants.
 *
 * Ce qui compte ici est ce que chaque branche REFUSE de dire. Aucune ne conclut à une
 * promesse rompue : établir qu'une page a changé n'établit pas qu'un vendeur a menti, et
 * confondre les deux serait exactement le défaut que ce registre existe pour exposer.
 */
export type DivergenceVerdict =
  | { kind: 'no_observed_change'; note: string }
  | { kind: 'presentation_drift'; note: string }
  | { kind: 'commercial_terms_divergence'; note: string }
  | { kind: 'extractor_drift'; note: string }
  | { kind: 'indeterminate'; note: string }

export function compareCaptures(
  atPayment: { entity_sha256?: string; terms_sha256?: string },
  now: { entity_sha256?: string; terms_sha256?: string },
): DivergenceVerdict {
  if (!atPayment.entity_sha256 || !now.entity_sha256 || !atPayment.terms_sha256 || !now.terms_sha256) {
    return {
      kind: 'indeterminate',
      note:
        'One of the two captures is missing a commitment, so nothing is compared. A failed or oversized capture is an explicit indeterminate row: never a match, never a divergence.',
    }
  }
  const sameEntity = atPayment.entity_sha256 === now.entity_sha256
  const sameTerms = atPayment.terms_sha256 === now.terms_sha256

  if (sameEntity && sameTerms) {
    return {
      kind: 'no_observed_change',
      note:
        'The same bytes and the same commercial tuple are served. This says the published surface has not moved; it says nothing about whether any promise was kept.',
    }
  }
  if (!sameEntity && sameTerms) {
    return {
      kind: 'presentation_drift',
      note:
        'The bytes changed but the commercial tuple did not: a date, a counter or a template moved. Nothing commercial is observed to have changed.',
    }
  }
  if (!sameEntity && !sameTerms) {
    return {
      kind: 'commercial_terms_divergence',
      note:
        'Both the bytes and the commercial tuple changed. The terms served today are not the terms served at the reference capture — which is not a breach, only that the version the seller invokes now is not the version the buyer met.',
    }
  }
  return {
    kind: 'extractor_drift',
    note:
      'The bytes are identical but our tuple is not, so the change is OURS: the extractor moved. This says nothing about the seller and must never be published as if it did.',
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
  const base: CanonicalCapture = {
    observed_at: now().toISOString(),
    url,
    // Jamais autre chose tant qu'un tiers n'engage pas l'empreinte. Voir le type.
    timestamp_independence: 'UNKNOWN',
  }

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
  const finalUrl = response.url && response.url !== url ? response.url : undefined
  const withHeaders: CanonicalCapture = {
    ...base,
    http_status: response.status,
    ...(finalUrl ? { final_url: finalUrl, redirect_chain: [finalUrl] } : {}),
    content_type: header('content-type'),
    content_encoding: header('content-encoding'),
    origin_validators: {
      etag: header('etag'),
      last_modified: header('last-modified'),
      date: header('date'),
    },
  }

  // Le plafond est contrôlé sur les octets RÉELLEMENT lus, pas sur `content-length` :
  // cet en-tête est déclaratif et peut mentir, et c'est précisément ce genre de confiance
  // qu'on refuse ailleurs.
  try {
    const buffer = new Uint8Array(await response.arrayBuffer())
    if (buffer.byteLength > MAX_CAPTURE_BYTES) {
      return { ...withHeaders, entity_bytes: buffer.byteLength, capture_failure: 'too_large' }
    }
    return { ...withHeaders, entity_bytes: buffer.byteLength, entity_sha256: sha256Hex(buffer) }
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
  if (capture.final_url) facts.final_url = capture.final_url
  if (capture.entity_sha256) facts.entity_sha256 = capture.entity_sha256
  if (capture.entity_bytes !== undefined) facts.entity_bytes = capture.entity_bytes
  if (capture.content_type) facts.content_type = capture.content_type
  if (capture.content_encoding) facts.content_encoding = capture.content_encoding
  // Les validateurs d'origine entrent dans les faits SOUS LEUR VRAI NOM : ils appartiennent
  // au vendeur, pas à un tiers. Le préfixe empêche de les relire comme une preuve de temps.
  if (capture.origin_validators?.etag) facts.origin_etag = capture.origin_validators.etag
  if (capture.origin_validators?.last_modified) facts.origin_last_modified = capture.origin_validators.last_modified
  facts.timestamp_independence = capture.timestamp_independence
  if (capture.capture_failure) facts.capture_failure = capture.capture_failure
  return facts
}
