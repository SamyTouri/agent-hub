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
export const COHORT_MIN_SUBJECTS = 20
export const COHORT_MAX_SUBJECTS = 50

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

/** Per-stratum maxima. They are ceilings, not quotas: a stratum that cannot be filled
 *  from the live catalogue stays short rather than being padded. */
export const STRATUM_CAPS: Record<CohortStratum, number> = {
  business_system_connector: 10,
  multi_source_identity: 12,
  availability_watch: 10,
  non_mcp_provenance: 8,
}

/** One subject per workplace-system family. Ten copies of the same connector would test
 *  nothing that one copy does not already test. */
export const BUSINESS_FAMILY_CAP = 1

/** Ceiling per non-MCP provenance, so the stratum does not silently become one registry. */
export const NON_MCP_PROVENANCE_CAP = 4

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

function provenanceOf(candidate: CandidateSubject): string {
  return candidate.externalSource ?? 'native'
}

function subjectKindOf(candidate: CandidateSubject): SubjectKind {
  return candidate.externalSource === 'mcp-registry' ? 'mcp_server' : 'agent'
}

/** Something we can actually go and look at over time. A subject with neither an endpoint
 *  nor a repository can only ever repeat what it says about itself. */
function hasObservableSurface(candidate: CandidateSubject): boolean {
  return isProbeableEndpoint(candidate.endpoint) || Boolean(candidate.repository)
}

/**
 * Deterministic selection: the same catalogue rows always produce the same cohort, in the
 * same order, whoever runs it. Strata are applied in declared order and a subject is only
 * ever picked once, so the precedence between two rules is recorded rather than accidental.
 */
export function selectCohort(candidates: readonly CandidateSubject[]): CohortPick[] {
  const seen = new Set<string>()
  const pool: CandidateSubject[] = []
  for (const candidate of [...candidates].sort(byHandleAsc)) {
    if (seen.has(candidate.agentId)) continue
    seen.add(candidate.agentId)
    pool.push(candidate)
  }

  const taken = new Set<string>()
  const picks: CohortPick[] = []

  const take = (candidate: CandidateSubject, pick: Omit<CohortPick, 'agentId' | 'handle' | 'subjectKind'>) => {
    taken.add(candidate.agentId)
    picks.push({
      agentId: candidate.agentId,
      handle: candidate.handle,
      subjectKind: subjectKindOf(candidate),
      ...pick,
    })
  }

  // 1. Workplace-system connectors — the family a governed-access buyer must approve.
  let businessCount = 0
  for (const { family } of BUSINESS_SYSTEM_FAMILIES) {
    if (businessCount >= STRATUM_CAPS.business_system_connector) break
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
      selectionRule: 'business_system_connector/v1',
      selectionFamily: family,
      selectionReason:
        `Workplace-system connector family "${family}". Tests whether the business-system subjects an ` +
        `access-governance buyer has to approve produce attributable change history over time. ${PROXY_DISCLAIMER}`,
    })
    businessCount++
  }

  // 2. Three independent surfaces on one identity — where sources can contradict.
  let multiSourceCount = 0
  for (const candidate of pool) {
    if (multiSourceCount >= STRATUM_CAPS.multi_source_identity) break
    if (taken.has(candidate.agentId)) continue
    if (candidate.externalSource !== 'mcp-registry') continue
    if (!candidate.repository || !isProbeableEndpoint(candidate.endpoint) || !candidate.hasRepositoryObservation) continue
    take(candidate, {
      stratum: 'multi_source_identity',
      selectionRule: 'multi_source_identity/v1',
      selectionFamily: null,
      selectionReason:
        'Observable through three independent surfaces at once: a registry entry, a source repository and a live ' +
        'endpoint. Tests identity resolution across sources and whether those sources start contradicting each ' +
        'other. The repository signal is used only as proof that a third collector looked, never as a quality score.',
    })
    multiSourceCount++
  }

  // 3. Subjects already in an availability incident — transitions are guaranteed here.
  let availabilityCount = 0
  for (const candidate of pool) {
    if (availabilityCount >= STRATUM_CAPS.availability_watch) break
    if (taken.has(candidate.agentId)) continue
    if (!isProbeableEndpoint(candidate.endpoint)) continue
    if (candidate.endpointCheck?.responded !== false) continue
    take(candidate, {
      stratum: 'availability_watch',
      selectionRule: 'availability_watch/v1',
      selectionFamily: null,
      selectionReason:
        'The last endpoint check did not answer. Tests that the ledger records availability transitions — a host ' +
        'going silent, and coming back — rather than one row per identical daily probe.',
    })
    availabilityCount++
  }

  // 4. Provenance outside the MCP registry, so the design is not shaped by one source.
  let nonMcpCount = 0
  const perProvenance = new Map<string, number>()
  for (const candidate of pool) {
    if (nonMcpCount >= STRATUM_CAPS.non_mcp_provenance) break
    if (taken.has(candidate.agentId)) continue
    if (candidate.externalSource === 'mcp-registry') continue
    const provenance = provenanceOf(candidate)
    const used = perProvenance.get(provenance) ?? 0
    if (used >= NON_MCP_PROVENANCE_CAP) continue
    take(candidate, {
      stratum: 'non_mcp_provenance',
      selectionRule: 'non_mcp_provenance/v1',
      selectionFamily: provenance,
      selectionReason:
        `Provenance "${provenance}", outside the MCP registry. Tests that the history layer works on subjects ` +
        'whose identity, fields and update rhythm are not those of a single registry.',
    })
    perProvenance.set(provenance, used + 1)
    nonMcpCount++
  }

  return picks
}

/**
 * Invariants a cohort must satisfy before it is written or trusted. Returned as a list
 * rather than thrown: an operator needs to see everything that is wrong at once.
 */
export function validateCohort(picks: readonly CohortPick[]): CohortProblem[] {
  const problems: CohortProblem[] = []

  if (picks.length < COHORT_MIN_SUBJECTS) {
    problems.push({ code: 'size_below_minimum', detail: `${picks.length} subjects, minimum ${COHORT_MIN_SUBJECTS}` })
  }
  if (picks.length > COHORT_MAX_SUBJECTS) {
    problems.push({ code: 'size_above_maximum', detail: `${picks.length} subjects, maximum ${COHORT_MAX_SUBJECTS}` })
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
    if (count > STRATUM_CAPS[stratum]) {
      problems.push({ code: 'stratum_over_cap', detail: `${stratum}: ${count} > ${STRATUM_CAPS[stratum]}` })
    }
  }

  const families = new Map<string, number>()
  for (const pick of picks) {
    if (pick.stratum !== 'business_system_connector' || !pick.selectionFamily) continue
    const count = (families.get(pick.selectionFamily) ?? 0) + 1
    families.set(pick.selectionFamily, count)
    if (count > BUSINESS_FAMILY_CAP) {
      problems.push({ code: 'family_over_cap', detail: `${pick.selectionFamily}: ${count} > ${BUSINESS_FAMILY_CAP}` })
    }
  }

  const provenances = new Map<string, number>()
  for (const pick of picks) {
    if (pick.stratum !== 'non_mcp_provenance' || !pick.selectionFamily) continue
    const count = (provenances.get(pick.selectionFamily) ?? 0) + 1
    provenances.set(pick.selectionFamily, count)
    if (count > NON_MCP_PROVENANCE_CAP) {
      problems.push({
        code: 'provenance_over_cap',
        detail: `${pick.selectionFamily}: ${count} > ${NON_MCP_PROVENANCE_CAP}`,
      })
    }
  }

  if (!picks.some((pick) => pick.stratum === 'non_mcp_provenance')) {
    problems.push({ code: 'missing_non_mcp_provenance', detail: 'the cohort would depend on a single registry' })
  }

  return problems
}
