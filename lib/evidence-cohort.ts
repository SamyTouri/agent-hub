// The tracked cohort — who we accumulate history about, and the recorded reason why.
//
// Coverage is not the point. The catalogue already lists ~17,500 subjects and produces
// almost no proprietary history; adding rows would not change that. What has to be proven
// first is that a bounded, deliberately chosen group produces attributable change history
// worth paying for. So the pilot is 20 to 50 subjects, and every one of them carries in
// the database the rule that selected it and the question it is meant to answer.
//
// Two temptations are refused explicitly:
//
//   - Pseudo-random "representativeness". A random draw from a catalogue that is itself
//     an arbitrary union of registries proves nothing about anything, and cannot be
//     defended to a buyer who asks why these subjects.
//   - Popularity as a proxy for quality. A star counter is a fact about attention, not
//     about a service. Where a repository signal appears below, only its EXISTENCE is
//     used — as evidence that a third source has looked at the subject — never its value,
//     and candidates are ordered alphabetically so the popular ones get no advantage.

import { isProbeableEndpoint, type EndpointCheck } from './endpoint-probe.ts'
import type { SubjectKind } from './evidence-history.ts'

export const COHORT_ID = 'pilot-2026-07'

export type CohortStratum =
  | 'business_system_connector'
  | 'multi_source_identity'
  | 'availability_watch'
  | 'non_mcp_provenance'

export const COHORT_STRATA: readonly CohortStratum[] = [
  'business_system_connector',
  'multi_source_identity',
  'availability_watch',
  'non_mcp_provenance',
]

/**
 * Une version de cohorte, en un seul objet.
 *
 * Versionner plutôt que remplacer : les quarante sujets de la v1 gardent leur règle et
 * leur raison telles qu'elles ont été écrites le jour de leur sélection. Étendre la
 * cohorte ne réécrit rien — c'est une strate d'ajouts, pas une nouvelle vérité sur les
 * anciens. Le champ `selection_rule` porte déjà le numéro de version en base, donc rien
 * de tout ceci n'a besoin d'une migration.
 */
export type CohortSpec = {
  version: number
  /** Plafonds par strate. Ce sont des plafonds, pas des quotas : une strate que le
   *  catalogue ne peut pas remplir reste courte plutôt que d'être rembourrée. */
  caps: Record<CohortStratum, number>
  businessFamilyCap: number
  nonMcpProvenanceCap: number
  /** Taille visée une fois la strate d'ajouts appliquée. */
  targetSubjects: number
  minSubjects: number
  maxSubjects: number
}

/** Pilote initial du 2026-07-27 : quarante sujets, test d'architecture. */
export const COHORT_SPEC_V1: CohortSpec = {
  version: 1,
  caps: {
    business_system_connector: 10,
    multi_source_identity: 12,
    availability_watch: 10,
    non_mcp_provenance: 8,
  },
  businessFamilyCap: 1,
  nonMcpProvenanceCap: 4,
  targetSubjects: 40,
  minSubjects: 20,
  maxSubjects: 50,
}

/**
 * Extension du 2026-07-28 — 112 sujets, et ce nombre est dérivé, pas arrondi.
 *
 * D'où viennent les plafonds :
 *
 *   - Connecteurs bureautiques : 3 par famille au lieu d'un. Un seul connecteur Slack ne
 *     permet pas de distinguer « cette famille bouge » de « ce vendeur bouge ». Trois le
 *     permettent. 10 familles × 3 = 30.
 *   - Identité multi-source : 30. C'est la surface où deux registres peuvent se
 *     contredire, et une contradiction ne se commande pas — elle s'attend.
 *   - Veille de disponibilité : 40, la plus grosse strate. C'est la SEULE dont on sait
 *     qu'elle produira des preuves : un hôte déjà muet finira par transiter. La question
 *     ouverte du pilote est de savoir si le journal accumule quoi que ce soit ; c'est
 *     cette strate qui y répond.
 *   - Provenance hors MCP : 12, le plafond de ce qui existe. Il n'y a qu'une vingtaine de
 *     sujets hors registre MCP au total, et tous n'ont pas de surface observable.
 *
 * Et pourquoi ce total tient : la cohorte entière doit rentrer dans UNE vague de sonde.
 * La vague fait 125 (concurrence délibérément non augmentée, voir la route quotidienne),
 * donc à 112 la cohorte est intégralement contrôlée à chaque passage même dans le pire
 * cas où chaque sujet serait sondable. C'est l'invariant qui garantit qu'un sujet suivi
 * est réellement suivi ; au-delà de 125 il tombe en silence.
 */
export const COHORT_SPEC_V2: CohortSpec = {
  version: 2,
  caps: {
    business_system_connector: 30,
    multi_source_identity: 30,
    availability_watch: 40,
    non_mcp_provenance: 12,
  },
  businessFamilyCap: 3,
  nonMcpProvenanceCap: 4,
  targetSubjects: 112,
  minSubjects: 100,
  maxSubjects: 120,
}

export const CURRENT_COHORT_SPEC: CohortSpec = COHORT_SPEC_V2

/** Largeur d'une vague de sonde du cron quotidien. La cohorte doit y tenir entièrement,
 *  sinon une partie des sujets suivis peut rester non contrôlée un jour donné. */
export const PROBE_WAVE_WIDTH = 125

export const STRATUM_CAPS: Record<CohortStratum, number> = CURRENT_COHORT_SPEC.caps
export const BUSINESS_FAMILY_CAP = CURRENT_COHORT_SPEC.businessFamilyCap
export const NON_MCP_PROVENANCE_CAP = CURRENT_COHORT_SPEC.nonMcpProvenanceCap
export const COHORT_MIN_SUBJECTS = CURRENT_COHORT_SPEC.minSubjects
export const COHORT_MAX_SUBJECTS = CURRENT_COHORT_SPEC.maxSubjects

/**
 * The families are a bounded proxy for the kind of workplace connector a governed-access
 * buyer has to approve before an agent may touch a company's mail, files or chat. They are
 * chosen from what such platforms publicly cover, and they are OURS: nothing here is a
 * partner's integration list, and no partner reviewed or endorsed this selection.
 */
export const BUSINESS_SYSTEM_FAMILIES: ReadonlyArray<{ family: string; keywords: readonly string[] }> = [
  { family: 'gmail', keywords: ['gmail', 'google mail'] },
  { family: 'slack', keywords: ['slack'] },
  { family: 'microsoft-teams', keywords: ['msteams', 'microsoft teams', 'ms teams'] },
  { family: 'google-drive', keywords: ['gdrive', 'googledrive', 'google drive'] },
  { family: 'google-sheets', keywords: ['gsheets', 'googlesheets', 'google sheets'] },
  { family: 'google-calendar', keywords: ['gcal', 'googlecalendar', 'google calendar'] },
  { family: 'notion', keywords: ['notion'] },
  { family: 'box', keywords: ['box'] },
  { family: 'github', keywords: ['github'] },
  { family: 'dropbox', keywords: ['dropbox'] },
]

export const PROXY_DISCLAIMER =
  'Selected independently by Agent Reputation as a bounded proxy for workplace-system connectors; not any vendor’s integration list and not endorsed by any vendor.'

export type CandidateSubject = {
  agentId: string
  handle: string
  displayName: string | null
  description: string
  /** null means native to Agent Reputation. */
  externalSource: string | null
  externalId: string | null
  endpoint: string | null
  repository: string | null
  /** A repository signal has been observed for this subject by a third collector. Only
   *  the existence of that observation is used; its value never is. */
  hasRepositoryObservation: boolean
  endpointCheck: EndpointCheck | null
}

export type CohortPick = {
  agentId: string
  handle: string
  subjectKind: SubjectKind
  stratum: CohortStratum
  /** Versioned identifier of the rule, so a future re-selection is comparable. */
  selectionRule: string
  selectionFamily: string | null
  selectionReason: string
}

export type CohortProblem = { code: string; detail: string }

const byHandleAsc = (a: CandidateSubject, b: CandidateSubject) =>
  a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0

/**
 * What a family keyword is matched against: the LAST segment of the handle plus the
 * display name. Two exclusions, both learned the hard way from the real catalogue.
 *
 * The namespace prefix is dropped because the MCP registry names almost everything
 * `io.github.<owner>/<repo>` — matching "github" against the whole handle would classify
 * thirteen thousand unrelated servers as GitHub connectors.
 *
 * The free-text description is dropped because descriptions routinely link to a source
 * repository or name a tool in passing; a weather server whose README mentions Slack is
 * not a Slack connector. A rule that has to be defended to a buyer has to be precise
 * enough to be wrong in public.
 */
export function familyHaystack(candidate: CandidateSubject): string {
  const segments = candidate.handle.split('/')
  const last = segments[segments.length - 1] || candidate.handle
  return `${last} ${candidate.displayName ?? ''}`
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Whole-token matching, so "box" never matches "dropbox" or "sandbox". Multi-word
 *  keywords must appear as consecutive tokens. */
function matchesKeyword(tokens: readonly string[], keyword: string): boolean {
  const needle = tokenize(keyword)
  if (needle.length === 0) return false
  for (let index = 0; index + needle.length <= tokens.length; index++) {
    if (needle.every((part, offset) => tokens[index + offset] === part)) return true
  }
  return false
}

/**
 * Postgres regular expression mirroring `matchesKeyword`, so the SQL pre-filter used by
 * the operator command selects exactly the same rows the rule would. A looser pre-filter
 * would silently starve a family: the alphabetically-first sixty "%box%" rows can all be
 * `sandbox-*` and the real connector never reaches the rule.
 */
export function familyRegex(keywords: readonly string[]): string {
  const alternatives = keywords.map((keyword) => keyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, '[^a-z0-9]+'))
  return `(^|[^a-z0-9])(${alternatives.join('|')})([^a-z0-9]|$)`
}

/** First declared family that matches. Declaration order is the tie-break, so a server
 *  named for both GitHub and Notion always lands in the same family. */
export function businessFamilyOf(candidate: CandidateSubject): string | null {
  const tokens = tokenize(familyHaystack(candidate))
  for (const { family, keywords } of BUSINESS_SYSTEM_FAMILIES) {
    if (keywords.some((keyword) => matchesKeyword(tokens, keyword))) return family
  }
  return null
}

/** Provenance label of a subject: its registry of origin, or `native` when it is ours. */
function provenanceLabel(externalSource: string | null | undefined): string {
  const trimmed = (externalSource ?? '').trim()
  return trimmed.length === 0 ? 'native' : trimmed
}

function provenanceOf(candidate: CandidateSubject): string {
  return provenanceLabel(candidate.externalSource)
}

/**
 * Provenances whose importer also appends profile observations, so their subjects
 * genuinely accumulate field history on their own. Everything else gets a baseline at
 * selection time plus whatever the endpoint probe records — and the stored reason has to
 * say so rather than promise a history nobody collects.
 */
export const PROVENANCES_WITH_FIELD_COLLECTOR: ReadonlySet<string> = new Set([
  'mcp-registry',
  'concordium-cis8004',
])

/**
 * Whether an importer already authors this provenance's profile chain.
 *
 * This is also the line the manual baseline must not cross. A collector reads the fresh
 * upstream payload and can see fields the stored catalogue row does not carry at all — the
 * Concordium importer records on-chain anchors, nothing in `agents` holds them. A manual
 * baseline built from the stored row would therefore be a COMPETING representation of the
 * same subject, and the collector's very first append would diff against it and record
 * "anchors added" as if the vendor had re-anchored an identity. In an append-only ledger
 * that lie cannot be edited out. So a provenance with a collector owns its chain alone.
 */
export function hasFieldCollector(externalSource: string | null | undefined): boolean {
  return PROVENANCES_WITH_FIELD_COLLECTOR.has(provenanceLabel(externalSource))
}

function nonMcpReason(provenance: string): string {
  const head = `Provenance "${provenance}", outside the MCP registry. Tests that the history layer works on subjects whose identity, fields and update rhythm are not those of a single registry.`
  return PROVENANCES_WITH_FIELD_COLLECTOR.has(provenance)
    ? `${head} Its importer appends profile observations, so field changes accumulate on their own.`
    : `${head} No importer appends profile observations for this provenance yet: expect a baseline plus endpoint availability, and no automatic field history until a collector exists.`
}

function subjectKindOf(candidate: CandidateSubject): SubjectKind {
  return candidate.externalSource === 'mcp-registry' ? 'mcp_server' : 'agent'
}

/** Something we can actually go and look at over time. A subject with neither an endpoint
 *  nor a repository can only ever repeat what it says about itself. */
function hasObservableSurface(candidate: CandidateSubject): boolean {
  return isProbeableEndpoint(candidate.endpoint) || Boolean(candidate.repository)
}

export type TrackedSubject = {
  agentId: string
  stratum: CohortStratum
  /** Famille ou provenance enregistrée à la sélection, pour que les sous-plafonds
   *  continuent de compter les sujets déjà suivis. */
  selectionFamily: string | null
}

export type SelectCohortOptions = {
  /** Version de cohorte à appliquer. Par défaut la version courante. */
  spec?: CohortSpec
  /** Sujets DÉJÀ dans la cohorte. Ils comptent dans les plafonds et ne sont jamais
   *  re-sélectionnés : étendre la cohorte ajoute une strate, ça ne réécrit pas l'histoire
   *  de sélection des anciens. */
  alreadyTracked?: readonly TrackedSubject[]
}

/**
 * Deterministic selection: the same catalogue rows always produce the same cohort, in the
 * same order, whoever runs it. Strata are applied in declared order and a subject is only
 * ever picked once, so the precedence between two rules is recorded rather than accidental.
 *
 * La sélection est INCRÉMENTALE. On lui passe ce qui est déjà suivi, et elle ne rend que
 * les ajouts nécessaires pour atteindre la cible. C'est ce qui permet d'étendre la cohorte
 * sans toucher aux quarante premiers sujets, et ce qui empêche le total de déborder quand
 * une version ultérieure sélectionnerait un ensemble différent.
 */
export function selectCohort(
  candidates: readonly CandidateSubject[],
  options: SelectCohortOptions = {},
): CohortPick[] {
  const spec = options.spec ?? CURRENT_COHORT_SPEC
  const tracked = options.alreadyTracked ?? []

  const seen = new Set<string>()
  const pool: CandidateSubject[] = []
  for (const candidate of [...candidates].sort(byHandleAsc)) {
    if (seen.has(candidate.agentId)) continue
    seen.add(candidate.agentId)
    pool.push(candidate)
  }

  const taken = new Set<string>(tracked.map((subject) => subject.agentId))
  const picks: CohortPick[] = []

  // Les compteurs démarrent à ce qui est déjà suivi : un plafond de strate est un plafond
  // sur la cohorte entière, pas sur le lot d'ajouts.
  const stratumCount = new Map<CohortStratum, number>()
  const familyCount = new Map<string, number>()
  const provenanceCount = new Map<string, number>()
  for (const subject of tracked) {
    stratumCount.set(subject.stratum, (stratumCount.get(subject.stratum) ?? 0) + 1)
    if (subject.selectionFamily === null) continue
    if (subject.stratum === 'business_system_connector') {
      familyCount.set(subject.selectionFamily, (familyCount.get(subject.selectionFamily) ?? 0) + 1)
    } else if (subject.stratum === 'non_mcp_provenance') {
      provenanceCount.set(subject.selectionFamily, (provenanceCount.get(subject.selectionFamily) ?? 0) + 1)
    }
  }

  const total = () => tracked.length + picks.length
  const countIn = (stratum: CohortStratum) => stratumCount.get(stratum) ?? 0
  const room = (stratum: CohortStratum) => total() < spec.targetSubjects && countIn(stratum) < spec.caps[stratum]
  const rule = (stratum: CohortStratum) => `${stratum}/v${spec.version}`

  const take = (candidate: CandidateSubject, pick: Omit<CohortPick, 'agentId' | 'handle' | 'subjectKind'>) => {
    taken.add(candidate.agentId)
    stratumCount.set(pick.stratum, countIn(pick.stratum) + 1)
    picks.push({
      agentId: candidate.agentId,
      handle: candidate.handle,
      subjectKind: subjectKindOf(candidate),
      ...pick,
    })
  }

  // 1. Workplace-system connectors — the family a governed-access buyer must approve.
  //    Le balayage tourne famille par famille : à trois par famille, on prend un
  //    connecteur de chacune avant d'en reprendre un deuxième quelque part, sinon les
  //    premières familles de la liste épuiseraient la strate à elles seules.
  for (let round = 0; round < spec.businessFamilyCap; round++) {
    for (const { family } of BUSINESS_SYSTEM_FAMILIES) {
      if (!room('business_system_connector')) break
      if ((familyCount.get(family) ?? 0) >= spec.businessFamilyCap) continue
      const match = pool.find(
        (candidate) =>
          !taken.has(candidate.agentId) &&
          candidate.externalSource === 'mcp-registry' &&
          hasObservableSurface(candidate) &&
          businessFamilyOf(candidate) === family,
      )
      if (!match) continue
      take(match, {
        stratum: 'business_system_connector',
        selectionRule: rule('business_system_connector'),
        selectionFamily: family,
        selectionReason:
          `Workplace-system connector family "${family}". Tests whether the business-system subjects an ` +
          `access-governance buyer has to approve produce attributable change history over time, and whether ` +
          `two connectors of the same family behave the same way. ${PROXY_DISCLAIMER}`,
      })
      familyCount.set(family, (familyCount.get(family) ?? 0) + 1)
    }
  }

  // 2. Three independent surfaces on one identity — where sources can contradict.
  for (const candidate of pool) {
    if (!room('multi_source_identity')) break
    if (taken.has(candidate.agentId)) continue
    if (candidate.externalSource !== 'mcp-registry') continue
    if (!candidate.repository || !isProbeableEndpoint(candidate.endpoint) || !candidate.hasRepositoryObservation) continue
    take(candidate, {
      stratum: 'multi_source_identity',
      selectionRule: rule('multi_source_identity'),
      selectionFamily: null,
      selectionReason:
        'Observable through three independent surfaces at once: a registry entry, a source repository and a live ' +
        'endpoint. Tests identity resolution across sources and whether those sources start contradicting each ' +
        'other. The repository signal is used only as proof that a third collector looked, never as a quality score.',
    })
  }

  // 3. Subjects already in an availability incident — transitions are guaranteed here.
  for (const candidate of pool) {
    if (!room('availability_watch')) break
    if (taken.has(candidate.agentId)) continue
    if (!isProbeableEndpoint(candidate.endpoint)) continue
    if (candidate.endpointCheck?.responded !== false) continue
    take(candidate, {
      stratum: 'availability_watch',
      selectionRule: rule('availability_watch'),
      selectionFamily: null,
      selectionReason:
        'The last endpoint check did not answer. Tests that the ledger records availability transitions — a host ' +
        'going silent, and coming back — rather than one row per identical daily probe.',
    })
  }

  // 4. Provenance outside the MCP registry, so the design is not shaped by one source.
  for (const candidate of pool) {
    if (!room('non_mcp_provenance')) break
    if (taken.has(candidate.agentId)) continue
    if (candidate.externalSource === 'mcp-registry') continue
    // Same requirement as every other stratum: a subject with nothing to look at can only
    // ever repeat what it says about itself, and would sit in the cohort producing a
    // single baseline forever.
    if (!hasObservableSurface(candidate)) continue
    const provenance = provenanceOf(candidate)
    const used = provenanceCount.get(provenance) ?? 0
    if (used >= spec.nonMcpProvenanceCap) continue
    take(candidate, {
      stratum: 'non_mcp_provenance',
      selectionRule: rule('non_mcp_provenance'),
      selectionFamily: provenance,
      selectionReason: nonMcpReason(provenance),
    })
    provenanceCount.set(provenance, used + 1)
  }

  return picks
}

/**
 * Invariants a cohort must satisfy before it is written or trusted. Returned as a list
 * rather than thrown: an operator needs to see everything that is wrong at once.
 */
export function validateCohort(
  picks: readonly CohortPick[],
  options: { spec?: CohortSpec } = {},
): CohortProblem[] {
  const spec = options.spec ?? CURRENT_COHORT_SPEC
  const problems: CohortProblem[] = []

  if (picks.length < spec.minSubjects) {
    problems.push({ code: 'size_below_minimum', detail: `${picks.length} subjects, minimum ${spec.minSubjects}` })
  }
  if (picks.length > spec.maxSubjects) {
    problems.push({ code: 'size_above_maximum', detail: `${picks.length} subjects, maximum ${spec.maxSubjects}` })
  }

  const subjects = new Set<string>()
  for (const pick of picks) {
    if (subjects.has(pick.agentId)) {
      problems.push({ code: 'duplicate_subject', detail: pick.handle })
    }
    subjects.add(pick.agentId)
    if (!COHORT_STRATA.includes(pick.stratum)) {
      problems.push({ code: 'unknown_stratum', detail: `${pick.handle}: ${pick.stratum}` })
    }
    if (pick.selectionReason.trim().length < 20) {
      problems.push({ code: 'empty_selection_reason', detail: pick.handle })
    }
    if (!/\/v\d+$/.test(pick.selectionRule)) {
      problems.push({ code: 'unversioned_selection_rule', detail: `${pick.handle}: ${pick.selectionRule}` })
    }
  }

  for (const stratum of COHORT_STRATA) {
    const count = picks.filter((pick) => pick.stratum === stratum).length
    if (count > spec.caps[stratum]) {
      problems.push({ code: 'stratum_over_cap', detail: `${stratum}: ${count} > ${spec.caps[stratum]}` })
    }
  }

  const families = new Map<string, number>()
  for (const pick of picks) {
    if (pick.stratum !== 'business_system_connector' || !pick.selectionFamily) continue
    const count = (families.get(pick.selectionFamily) ?? 0) + 1
    families.set(pick.selectionFamily, count)
    if (count > spec.businessFamilyCap) {
      problems.push({ code: 'family_over_cap', detail: `${pick.selectionFamily}: ${count} > ${spec.businessFamilyCap}` })
    }
  }

  const provenances = new Map<string, number>()
  for (const pick of picks) {
    if (pick.stratum !== 'non_mcp_provenance' || !pick.selectionFamily) continue
    const count = (provenances.get(pick.selectionFamily) ?? 0) + 1
    provenances.set(pick.selectionFamily, count)
    if (count > spec.nonMcpProvenanceCap) {
      problems.push({
        code: 'provenance_over_cap',
        detail: `${pick.selectionFamily}: ${count} > ${spec.nonMcpProvenanceCap}`,
      })
    }
  }

  if (!picks.some((pick) => pick.stratum === 'non_mcp_provenance')) {
    problems.push({ code: 'missing_non_mcp_provenance', detail: 'the cohort would depend on a single registry' })
  }

  return problems
}
