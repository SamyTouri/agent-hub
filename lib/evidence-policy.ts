// Turning a chronology into a decision — relative to criteria someone supplied.
//
// This is the part the whole ledger exists for, and the part most likely to be misused.
// A buyer does not want to know whether a service is "good"; they want to know whether
// the evidence supports activating it under THEIR rules. So the output is never a score,
// never a ranking, never a certification, and it means nothing outside the policy that
// produced it. Two policies over the same history can legitimately disagree.
//
// Three rules make that defensible:
//
//   1. Absence of evidence is never failure. A criterion we cannot decide returns
//      `unknown` and pushes the whole evaluation towards `insufficient_evidence`.
//      Silently treating "we never saw it" as "it is not there" would let us condemn a
//      supplier for our own lack of coverage.
//   2. The evaluator has no discretion. `conditional_activation` only ever comes from a
//      criterion the policy itself declared conditional, with a safeguard the policy
//      author wrote. Nothing here decides that something is "probably fine".
//   3. Sources are never merged. Two registries that disagree produce a contradiction
//      with both values and both observation ids, not an averaged truth.
//
// The vocabulary is deliberately tiny and closed. No expressions, no user-supplied code,
// no weights: six kinds, each mapping to a question a buyer actually asks. A policy that
// cannot be read aloud in one sentence per criterion is not auditable, and an
// unauditable decision aid is worse than none.

import type { EvidenceFacts, JsonValue } from './evidence-history.ts'
import type { StoredObservation, TimelineSubject } from './evidence-timeline.ts'

export const POLICY_EVALUATION_SCHEMA = 'https://agentreputation.dev/schemas/policy-evaluation/v1'

/** Bumped when a criterion kind changes meaning. A policy declares the version it was
 *  written against, so an old policy can never be silently reinterpreted. */
export const POLICY_VOCABULARY_VERSION = 1

/** Bumped when the precedence or the wording of a result changes. */
export const EVALUATOR_VERSION = 1

export type CriterionRequirement = 'required' | 'conditional' | 'informational'

export type CriterionResult = 'passed' | 'failed' | 'unknown' | 'conditional'

export type PolicyDecision =
  | 'criteria_satisfied'
  | 'conditional_activation'
  | 'insufficient_evidence'
  | 'criteria_not_satisfied'

/**
 * Allowed values are scalars only, and typed scalars at that. The string "true" and the
 * boolean true are different observations, and a policy that cannot tell them apart would
 * silently accept the wrong one. Objects and arrays are refused outright: a set membership
 * test over structures is not readable aloud, and unreadable means unauditable.
 */
export type PolicyScalar = string | number | boolean

type CriterionBase = {
  id: string
  requirement: CriterionRequirement
  /** What the operator must do if this conditional criterion is not cleanly satisfied.
   *  Mandatory for `conditional`: a condition without a remedy is just a shrug. */
  safeguard?: string
  description?: string
}

export type PolicyCriterion = CriterionBase &
  (
    | { kind: 'source_present'; source: string }
    | { kind: 'field_present'; source: string; field: string }
    | { kind: 'field_in'; source: string; field: string; allowed: readonly PolicyScalar[] }
    | { kind: 'no_change_since'; source: string; days: number; field?: string }
    | { kind: 'checked_since'; source: string; days: number }
    | { kind: 'no_contradiction'; sources: readonly string[]; field: string }
  )

export const POLICY_CRITERION_KINDS: readonly PolicyCriterion['kind'][] = [
  'source_present',
  'field_present',
  'field_in',
  'no_change_since',
  'checked_since',
  'no_contradiction',
]

export type ActivationPolicy = {
  id: string
  version: string
  vocabularyVersion: number
  title?: string
  /** Free text describing the buyer's intent. Never parsed, only echoed. */
  intent?: string
  criteria: readonly PolicyCriterion[]
}

/**
 * Everything the evaluator is allowed to look at.
 *
 * `lastCheckedAt` comes from the CURRENT-STATE record, not from the ledger — deliberately.
 * The ledger only writes on change, so the age of the last observation says nothing about
 * when we last looked. Reading freshness off the ledger would declare a perfectly stable
 * supplier stale. When the caller cannot supply it, freshness is `unknown` and says why.
 */
export type EvidenceDossier = {
  subject: TimelineSubject
  observations: readonly StoredObservation[]
  lastCheckedAt?: Readonly<Record<string, string | null | undefined>>
}

export type EvidenceReference = {
  source: string
  observation_id: string
  observed_at: string
}

export type CriterionEvaluation = {
  id: string
  kind: PolicyCriterion['kind']
  requirement: CriterionRequirement
  result: CriterionResult
  /** Plain language, and specific: it has to survive being quoted back at us. */
  explanation: string
  references: EvidenceReference[]
  safeguard?: string
  /** Set when the result is `unknown`, so the gap is nameable rather than implied. */
  unknown_reason?: string
}

export type PolicyEvaluation = {
  schema: string
  evaluator_version: number
  vocabulary_version: number
  decision: PolicyDecision
  decision_basis: string
  policy: { id: string; version: string; title?: string; intent?: string }
  subject: { handle: string; provenance: string; subject_kind: string }
  evidence_cutoff: string
  criteria: CriterionEvaluation[]
  unknowns: string[]
  limitations: string[]
  disclaimer: string
}

export const EVALUATION_LIMITATIONS: readonly string[] = [
  'This is a decision aid relative to the supplied policy, not a score, a ranking or a certification.',
  'It says nothing outside those criteria: two policies over the same history can legitimately disagree.',
  'Evidence we do not have is reported as unknown, never counted against the subject.',
  'History starts when we started tracking the subject, not when the subject started existing.',
  'Independent sources are reported separately; a contradiction is shown, never averaged away.',
]

export const EVALUATION_DISCLAIMER =
  'Relative to the supplied criteria at the stated evidence cutoff. Not a certification, not a security ' +
  'review, and not a statement that the service works, delivers or is honest.'

// ---------------------------------------------------------------------------
// Policy validation
// ---------------------------------------------------------------------------

export type PolicyProblem = { code: string; detail: string }

export function validatePolicy(policy: ActivationPolicy): PolicyProblem[] {
  const problems: PolicyProblem[] = []
  if (policy.vocabularyVersion !== POLICY_VOCABULARY_VERSION) {
    problems.push({
      code: 'unsupported_vocabulary',
      detail: `policy targets vocabulary ${policy.vocabularyVersion}, evaluator speaks ${POLICY_VOCABULARY_VERSION}`,
    })
  }
  if (!policy.id.trim() || !policy.version.trim()) {
    problems.push({ code: 'unidentified_policy', detail: 'a policy needs an id and a version to be citable' })
  }
  if (policy.criteria.length === 0) {
    problems.push({ code: 'empty_policy', detail: 'a policy with no criteria decides nothing' })
  }

  const seen = new Set<string>()
  for (const criterion of policy.criteria) {
    if (seen.has(criterion.id)) problems.push({ code: 'duplicate_criterion', detail: criterion.id })
    seen.add(criterion.id)
    if (!POLICY_CRITERION_KINDS.includes(criterion.kind)) {
      problems.push({ code: 'unknown_kind', detail: `${criterion.id}: ${criterion.kind}` })
      continue
    }
    // A conditional criterion without a remedy would make the evaluator invent one.
    if (criterion.requirement === 'conditional' && !criterion.safeguard?.trim()) {
      problems.push({ code: 'conditional_without_safeguard', detail: criterion.id })
    }
    if (criterion.requirement !== 'conditional' && criterion.safeguard) {
      problems.push({ code: 'safeguard_without_condition', detail: criterion.id })
    }
    if ((criterion.kind === 'no_change_since' || criterion.kind === 'checked_since') && !(criterion.days > 0)) {
      problems.push({ code: 'non_positive_window', detail: criterion.id })
    }
    if (criterion.kind === 'field_in' && criterion.allowed.length === 0) {
      problems.push({ code: 'empty_allowed_set', detail: criterion.id })
    }
    if (criterion.kind === 'no_contradiction') {
      const unique = new Set(criterion.sources)
      if (criterion.sources.length !== 2 || unique.size !== 2) {
        problems.push({ code: 'contradiction_needs_two_sources', detail: criterion.id })
      }
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// Runtime parsing of an untrusted policy document
// ---------------------------------------------------------------------------

const MAX_TEXT = 400
const MAX_CRITERIA = 64
const REQUIREMENTS: readonly CriterionRequirement[] = ['required', 'conditional', 'informational']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bounded(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

export type PolicyParseResult = { ok: true; policy: ActivationPolicy } | { ok: false; problems: PolicyProblem[] }

/**
 * Parses a policy that came from outside — a file, an agent, a buyer.
 *
 * The typed API can trust its caller; this cannot. A cast would let
 * `requirement: "Required"` through, and a criterion with an unrecognised requirement is
 * not merely ignored: it drops out of the decidable set, so a policy whose only real
 * constraint was misspelled would come back `criteria_satisfied`. A capitalisation typo
 * must never read as approval.
 *
 * Everything is refused unless it is explicitly recognised: unknown keys are tolerated but
 * never trusted, and every value is checked for type, shape and bounds before it can reach
 * a decision. Problems are returned, never thrown as raw `TypeError`s.
 */
export function parsePolicyDocument(value: unknown): PolicyParseResult {
  const problems: PolicyProblem[] = []
  if (!isRecord(value)) {
    return { ok: false, problems: [{ code: 'not_an_object', detail: `a policy must be a JSON object, received ${Array.isArray(value) ? 'array' : typeof value}` }] }
  }
  if (!bounded(value.id)) problems.push({ code: 'invalid_id', detail: 'id must be a non-blank string' })
  if (!bounded(value.version, 64)) problems.push({ code: 'invalid_version', detail: 'version must be a non-blank string' })
  if (typeof value.vocabularyVersion !== 'number' || !Number.isInteger(value.vocabularyVersion)) {
    problems.push({ code: 'invalid_vocabulary_version', detail: 'vocabularyVersion must be an integer' })
  }
  for (const key of ['title', 'intent'] as const) {
    if (value[key] !== undefined && !bounded(value[key], 2000)) {
      problems.push({ code: `invalid_${key}`, detail: `${key} must be a non-blank string when present` })
    }
  }
  if (!Array.isArray(value.criteria)) {
    problems.push({ code: 'criteria_not_an_array', detail: 'criteria must be an array' })
    return { ok: false, problems }
  }
  if (value.criteria.length === 0) problems.push({ code: 'empty_policy', detail: 'a policy with no criteria decides nothing' })
  if (value.criteria.length > MAX_CRITERIA) {
    problems.push({ code: 'too_many_criteria', detail: `${value.criteria.length} criteria, maximum ${MAX_CRITERIA}` })
  }

  const seen = new Set<string>()
  const criteria: PolicyCriterion[] = []
  value.criteria.forEach((raw, index) => {
    const where = `criteria[${index}]`
    if (!isRecord(raw)) {
      problems.push({ code: 'criterion_not_an_object', detail: where })
      return
    }
    const id = raw.id
    if (!bounded(id, 120)) {
      problems.push({ code: 'invalid_criterion_id', detail: where })
      return
    }
    if (seen.has(id)) problems.push({ code: 'duplicate_criterion', detail: id })
    seen.add(id)

    const requirement = raw.requirement
    if (typeof requirement !== 'string' || !REQUIREMENTS.includes(requirement as CriterionRequirement)) {
      problems.push({ code: 'invalid_requirement', detail: `${id}: ${JSON.stringify(requirement)} (expected one of ${REQUIREMENTS.join(', ')})` })
      return
    }
    const kind = raw.kind
    if (typeof kind !== 'string' || !POLICY_CRITERION_KINDS.includes(kind as PolicyCriterion['kind'])) {
      problems.push({ code: 'unknown_kind', detail: `${id}: ${JSON.stringify(kind)}` })
      return
    }
    if (raw.safeguard !== undefined && !bounded(raw.safeguard, 1000)) {
      problems.push({ code: 'invalid_safeguard', detail: id })
      return
    }
    if (raw.description !== undefined && !bounded(raw.description, 2000)) {
      problems.push({ code: 'invalid_description', detail: id })
      return
    }

    const base = {
      id,
      requirement: requirement as CriterionRequirement,
      ...(raw.safeguard === undefined ? {} : { safeguard: raw.safeguard as string }),
      ...(raw.description === undefined ? {} : { description: raw.description as string }),
    }

    const needsSource = kind !== 'no_contradiction'
    if (needsSource && !bounded(raw.source, 80)) {
      problems.push({ code: 'invalid_source', detail: `${id}: source must be a non-blank string` })
      return
    }
    const needsField = kind === 'field_present' || kind === 'field_in' || kind === 'no_contradiction'
    if (needsField && !bounded(raw.field, 200)) {
      problems.push({ code: 'invalid_field', detail: `${id}: field must be a non-blank string` })
      return
    }

    switch (kind) {
      case 'source_present':
        criteria.push({ ...base, kind, source: raw.source as string })
        return
      case 'field_present':
        criteria.push({ ...base, kind, source: raw.source as string, field: raw.field as string })
        return
      case 'field_in': {
        if (!Array.isArray(raw.allowed) || raw.allowed.length === 0) {
          problems.push({ code: 'empty_allowed_set', detail: id })
          return
        }
        const scalars: PolicyScalar[] = []
        for (const candidate of raw.allowed) {
          const usable =
            (typeof candidate === 'string' && candidate.length <= MAX_TEXT) ||
            typeof candidate === 'boolean' ||
            (typeof candidate === 'number' && Number.isFinite(candidate))
          if (!usable) {
            problems.push({ code: 'invalid_allowed_value', detail: `${id}: ${JSON.stringify(candidate) ?? String(candidate)}` })
            return
          }
          scalars.push(candidate as PolicyScalar)
        }
        criteria.push({ ...base, kind, source: raw.source as string, field: raw.field as string, allowed: scalars })
        return
      }
      case 'no_change_since':
      case 'checked_since': {
        const days = raw.days
        // Rejects NaN and Infinity as well as zero and negatives: an infinite window is
        // not a stability claim, it is a way of never being wrong.
        if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0 || days > 3650) {
          problems.push({ code: 'non_positive_window', detail: `${id}: ${JSON.stringify(days) ?? String(days)}` })
          return
        }
        if (kind === 'checked_since') {
          criteria.push({ ...base, kind, source: raw.source as string, days })
        } else {
          if (raw.field !== undefined && !bounded(raw.field, 200)) {
            problems.push({ code: 'invalid_field', detail: id })
            return
          }
          criteria.push({
            ...base,
            kind,
            source: raw.source as string,
            days,
            ...(raw.field === undefined ? {} : { field: raw.field as string }),
          })
        }
        return
      }
      case 'no_contradiction': {
        const sources = raw.sources
        if (!Array.isArray(sources) || sources.length !== 2 || !sources.every((entry) => bounded(entry, 80))) {
          problems.push({ code: 'contradiction_needs_two_sources', detail: id })
          return
        }
        if (sources[0] === sources[1]) {
          problems.push({ code: 'contradiction_needs_two_sources', detail: id })
          return
        }
        criteria.push({ ...base, kind, sources: sources as string[], field: raw.field as string })
        return
      }
    }
  })

  if (problems.length > 0) return { ok: false, problems }

  const policy: ActivationPolicy = {
    id: value.id as string,
    version: value.version as string,
    vocabularyVersion: value.vocabularyVersion as number,
    ...(value.title === undefined ? {} : { title: value.title as string }),
    ...(value.intent === undefined ? {} : { intent: value.intent as string }),
    criteria,
  }
  // Second pass through the typed validator: the semantic rules (safeguard pairing,
  // vocabulary version) live there and must apply to parsed documents too.
  const semantic = validatePolicy(policy)
  if (semantic.length > 0) return { ok: false, problems: semantic }
  return { ok: true, policy }
}

// ---------------------------------------------------------------------------
// Reading the dossier
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

function factAt(facts: EvidenceFacts, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = facts
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = current[segment]
  }
  return current
}

function renderFact(value: JsonValue | undefined): string {
  if (value === undefined) return 'absent'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function reference(observation: StoredObservation): EvidenceReference {
  return { source: observation.source, observation_id: observation.id, observed_at: observation.observedAt }
}

type SourceView = {
  source: string
  /** Oldest first, cutoff applied. */
  observations: StoredObservation[]
  head: StoredObservation
  firstObservedAt: string
}

function sourceViews(
  dossier: EvidenceDossier,
  cutoffMs: number,
): { views: Map<string, SourceView>; undated: StoredObservation[] } {
  const grouped = new Map<string, StoredObservation[]>()
  const undated: StoredObservation[] = []
  for (const observation of dossier.observations) {
    const observedMs = Date.parse(observation.observedAt)
    // Fail closed on an unusable timestamp. `NaN > cutoff` is false, so a malformed date
    // would otherwise sail past the cutoff test and be treated as evidence in force —
    // the one direction an evidence layer must never fail in.
    if (!Number.isFinite(observedMs)) {
      undated.push(observation)
      continue
    }
    if (observedMs > cutoffMs) continue
    const bucket = grouped.get(observation.source)
    if (bucket) bucket.push(observation)
    else grouped.set(observation.source, [observation])
  }
  const views = new Map<string, SourceView>()
  for (const [source, rows] of grouped) {
    rows.sort((a, b) => a.seq - b.seq)
    views.set(source, {
      source,
      observations: rows,
      head: rows[rows.length - 1],
      firstObservedAt: rows[0].observedAt,
    })
  }
  return { views, undated }
}

// ---------------------------------------------------------------------------
// Criterion evaluation — each one answers exactly one question
// ---------------------------------------------------------------------------

type Verdict = { met: boolean | null; explanation: string; references: EvidenceReference[]; unknownReason?: string }

const missingSource = (source: string): Verdict => ({
  met: null,
  explanation: `We hold no observation from "${source}" for this subject at the cutoff.`,
  references: [],
  unknownReason: `no_evidence_from_source:${source}`,
})

function judge(criterion: PolicyCriterion, views: Map<string, SourceView>, dossier: EvidenceDossier, cutoffMs: number): Verdict {
  switch (criterion.kind) {
    case 'source_present': {
      const view = views.get(criterion.source)
      if (!view) return missingSource(criterion.source)
      return {
        met: true,
        explanation: `${view.observations.length} observation(s) from "${criterion.source}", first seen ${view.firstObservedAt}.`,
        references: [reference(view.head)],
      }
    }

    case 'field_present': {
      const view = views.get(criterion.source)
      if (!view) return missingSource(criterion.source)
      const value = factAt(view.head.facts, criterion.field)
      return {
        met: value !== undefined,
        explanation:
          value === undefined
            ? `"${criterion.field}" is absent from the current state reported by "${criterion.source}".`
            : `"${criterion.field}" is present in the current state reported by "${criterion.source}".`,
        references: [reference(view.head)],
      }
    }

    case 'field_in': {
      const view = views.get(criterion.source)
      if (!view) return missingSource(criterion.source)
      const value = factAt(view.head.facts, criterion.field)
      if (value === undefined) {
        // Never observed is not the same as observed-and-disallowed.
        return {
          met: null,
          explanation: `"${criterion.field}" has never been observed from "${criterion.source}", so it cannot be checked against the allowed set.`,
          references: [reference(view.head)],
          unknownReason: `field_never_observed:${criterion.source}.${criterion.field}`,
        }
      }
      if (value === null || typeof value === 'object') {
        // A set membership test over a structure is not a question anyone can audit.
        return {
          met: null,
          explanation: `"${criterion.field}" from "${criterion.source}" is not a scalar, so a membership test would not mean anything.`,
          references: [reference(view.head)],
          unknownReason: `field_not_scalar:${criterion.source}.${criterion.field}`,
        }
      }
      // Typed comparison: the string "true" is not the boolean true, and conflating them
      // would let a policy accept a value it never meant to allow.
      const allowed = criterion.allowed.some((candidate) => candidate === value)
      return {
        met: allowed,
        explanation: `"${criterion.field}" is ${JSON.stringify(value)} according to "${criterion.source}"; the policy allows ${JSON.stringify(criterion.allowed)}.`,
        references: [reference(view.head)],
      }
    }

    case 'no_change_since': {
      const view = views.get(criterion.source)
      if (!view) return missingSource(criterion.source)
      const windowStart = cutoffMs - criterion.days * DAY_MS
      // Only claim stability over a period we actually watched. Answering "passed"
      // because our own history is younger than the question would be a lie by omission.
      if (Date.parse(view.firstObservedAt) > windowStart) {
        return {
          met: null,
          explanation: `We have only been tracking "${criterion.source}" since ${view.firstObservedAt}, which is inside the ${criterion.days}-day window the policy asks about.`,
          references: [reference(view.observations[0])],
          unknownReason: `history_shorter_than_window:${criterion.source}`,
        }
      }
      const inWindow = view.observations.filter(
        (observation) => observation.previousObservationId !== null && Date.parse(observation.observedAt) >= windowStart,
      )
      // A change summary can be truncated when a subject moved dozens of fields at once.
      // If we are asked about one field and the list we hold is incomplete, we cannot say
      // the field stayed put — so we say we do not know.
      if (criterion.field !== undefined) {
        const truncated = inWindow.filter((observation) =>
          observation.changeSummary.some((change) => change.path === '$truncated'),
        )
        if (truncated.length > 0) {
          return {
            met: null,
            explanation: `A change summary in the window is truncated, so we cannot tell whether "${criterion.field}" was among the fields that moved.`,
            references: truncated.map(reference),
            unknownReason: `change_summary_truncated:${criterion.source}.${criterion.field}`,
          }
        }
      }
      const touched = inWindow.filter((observation) =>
        observation.changeSummary.some((change) => {
          if (criterion.field === undefined) return true
          // A change on a parent path rewrites the child, and a change on a child path
          // changes the parent. Both count as touching the field that was asked about.
          return (
            change.path === criterion.field ||
            change.path.startsWith(`${criterion.field}.`) ||
            criterion.field.startsWith(`${change.path}.`)
          )
        }),
      )
      const what = criterion.field === undefined ? 'anything' : `"${criterion.field}"`
      return {
        met: touched.length === 0,
        explanation:
          touched.length === 0
            ? `No change to ${what} from "${criterion.source}" in the ${criterion.days} days before the cutoff.`
            : `${touched.length} change(s) to ${what} from "${criterion.source}" in the ${criterion.days} days before the cutoff, the latest on ${touched[touched.length - 1].observedAt}.`,
        references: touched.length === 0 ? [reference(view.head)] : touched.map(reference),
      }
    }

    case 'checked_since': {
      const checkedAt = dossier.lastCheckedAt?.[criterion.source]
      if (!checkedAt) {
        return {
          met: null,
          explanation:
            `We cannot prove from the ledger when "${criterion.source}" was last checked: the ledger only records changes, ` +
            'so the age of the last observation is not the age of the last look.',
          references: [],
          unknownReason: `last_check_not_supplied:${criterion.source}`,
        }
      }
      const checkedMs = Date.parse(checkedAt)
      if (!Number.isFinite(checkedMs)) {
        // An unusable date is not a stale one. Calling it `failed` would blame a supplier
        // for our own broken record.
        return {
          met: null,
          explanation: `The last-check date recorded for "${criterion.source}" (${JSON.stringify(checkedAt)}) is not a usable timestamp.`,
          references: [],
          unknownReason: `last_check_unparseable:${criterion.source}`,
        }
      }
      if (checkedMs > cutoffMs) {
        // A check dated after the cutoff is outside the evidence we agreed to consider.
        // Letting it pass would quietly break the cutoff the whole document rests on.
        return {
          met: null,
          explanation: `The last check of "${criterion.source}" is dated ${checkedAt}, after the evidence cutoff, so it is outside what this evaluation may use.`,
          references: [],
          unknownReason: `last_check_after_cutoff:${criterion.source}`,
        }
      }
      return {
        met: cutoffMs - checkedMs <= criterion.days * DAY_MS,
        explanation: `"${criterion.source}" was last checked on ${checkedAt}; the policy requires a check within ${criterion.days} day(s) of the cutoff.`,
        references: [],
      }
    }

    case 'no_contradiction': {
      const [left, right] = criterion.sources
      const leftView = views.get(left)
      const rightView = views.get(right)
      if (!leftView) return missingSource(left)
      if (!rightView) return missingSource(right)
      const leftValue = factAt(leftView.head.facts, criterion.field)
      const rightValue = factAt(rightView.head.facts, criterion.field)
      if (leftValue === undefined || rightValue === undefined) {
        return {
          met: null,
          explanation: `"${criterion.field}" is not reported by both sources, so they cannot be compared.`,
          references: [reference(leftView.head), reference(rightView.head)],
          unknownReason: `field_not_comparable:${criterion.field}`,
        }
      }
      // Compared as typed JSON, so the string "true" and the boolean true count as the
      // disagreement they are.
      const agree = JSON.stringify(leftValue) === JSON.stringify(rightValue)
      return {
        met: agree,
        // Both values are named. Nothing here decides which source is right.
        explanation: agree
          ? `"${left}" and "${right}" both report ${JSON.stringify(leftValue)} for "${criterion.field}".`
          : `"${left}" reports ${JSON.stringify(leftValue)} for "${criterion.field}" while "${right}" reports ${JSON.stringify(rightValue)}. We do not arbitrate between them.`,
        references: [reference(leftView.head), reference(rightView.head)],
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * Precedence, in this order and no other:
 *
 *   1. a REQUIRED criterion that failed        -> criteria_not_satisfied
 *   2. a REQUIRED criterion we cannot decide   -> insufficient_evidence
 *   3. a CONDITIONAL criterion not cleanly met -> conditional_activation
 *   4. otherwise                               -> criteria_satisfied
 *
 * Rule 1 sits above rule 2 deliberately: a proven failure must never be softened into
 * "we are not sure" because something else was unknown.
 */
function decide(criteria: readonly CriterionEvaluation[]): { decision: PolicyDecision; basis: string } {
  const required = criteria.filter((criterion) => criterion.requirement === 'required')
  const failed = required.filter((criterion) => criterion.result === 'failed')
  if (failed.length > 0) {
    return {
      decision: 'criteria_not_satisfied',
      basis: `required criteria not met: ${failed.map((criterion) => criterion.id).join(', ')}`,
    }
  }
  const unknown = required.filter((criterion) => criterion.result === 'unknown')
  if (unknown.length > 0) {
    return {
      decision: 'insufficient_evidence',
      basis: `required criteria we cannot decide on the evidence held: ${unknown.map((criterion) => criterion.id).join(', ')}`,
    }
  }
  const conditional = criteria.filter((criterion) => criterion.result === 'conditional')
  if (conditional.length > 0) {
    return {
      decision: 'conditional_activation',
      basis: `policy-declared conditions apply: ${conditional.map((criterion) => criterion.id).join(', ')}`,
    }
  }
  return {
    decision: 'criteria_satisfied',
    basis: `every required criterion is met at the stated cutoff (${required.length} required, ${criteria.length} evaluated)`,
  }
}

export function evaluatePolicy(input: {
  dossier: EvidenceDossier
  policy: ActivationPolicy
  cutoff: string
}): PolicyEvaluation {
  const problems = validatePolicy(input.policy)
  if (problems.length > 0) {
    throw new Error(`invalid policy: ${problems.map((problem) => `${problem.code}(${problem.detail})`).join('; ')}`)
  }
  const cutoffMs = Date.parse(input.cutoff)
  if (!Number.isFinite(cutoffMs)) throw new Error(`invalid evidence cutoff: ${input.cutoff}`)

  const { views, undated } = sourceViews(input.dossier, cutoffMs)

  // Declared order, always. An agent diffing two evaluations must not see phantom moves.
  const criteria: CriterionEvaluation[] = input.policy.criteria.map((criterion) => {
    const verdict = judge(criterion, views, input.dossier, cutoffMs)
    let result: CriterionResult
    if (verdict.met === true) result = 'passed'
    // A conditional criterion becomes `conditional` whether the evidence said no or said
    // nothing. That is deliberate: the policy author already wrote what to do in either
    // case, and the `unknown_reason` below is kept so the reader can tell which happened.
    else if (criterion.requirement === 'conditional') result = 'conditional'
    else if (verdict.met === null) result = 'unknown'
    else result = 'failed'

    return {
      id: criterion.id,
      kind: criterion.kind,
      requirement: criterion.requirement,
      result,
      explanation: verdict.explanation,
      references: verdict.references,
      ...(criterion.safeguard ? { safeguard: criterion.safeguard } : {}),
      ...(verdict.unknownReason ? { unknown_reason: verdict.unknownReason } : {}),
    }
  })

  const decidable = criteria.filter((criterion) => criterion.requirement !== 'informational')
  const { decision, basis } = decide(decidable)

  return {
    schema: POLICY_EVALUATION_SCHEMA,
    evaluator_version: EVALUATOR_VERSION,
    vocabulary_version: POLICY_VOCABULARY_VERSION,
    decision,
    decision_basis: basis,
    policy: {
      id: input.policy.id,
      version: input.policy.version,
      ...(input.policy.title ? { title: input.policy.title } : {}),
      ...(input.policy.intent ? { intent: input.policy.intent } : {}),
    },
    subject: {
      handle: input.dossier.subject.handle,
      provenance: input.dossier.subject.provenance,
      subject_kind: input.dossier.subject.subjectKind,
    },
    evidence_cutoff: input.cutoff,
    criteria,
    unknowns: [
      ...criteria
        .filter((criterion) => criterion.unknown_reason !== undefined)
        .map((criterion) => `${criterion.id}: ${criterion.unknown_reason}`),
      ...(undated.length > 0
        ? [`dossier: unusable_observation_dates=${undated.length}`]
        : []),
    ],
    limitations: [
      ...EVALUATION_LIMITATIONS,
      ...(undated.length > 0
        ? [`${undated.length} observation(s) carry an unusable date and were excluded rather than assumed current.`]
        : []),
    ],
    disclaimer: EVALUATION_DISCLAIMER,
  }
}

// ---------------------------------------------------------------------------
// Freshness that the current state genuinely carries
// ---------------------------------------------------------------------------

/**
 * Which sources we can honestly date a last look for.
 *
 * `agents.updated_at` is NOT one of them, and the temptation to use it is exactly the bug
 * this function exists to prevent. A generic trigger refreshes that column on any write to
 * the row — including the endpoint probe storing its own result, a claim, or a maintenance
 * script. Feeding it to a registry `checked_since` criterion would let an unrelated write
 * certify that we had recently re-read the registry. We had not.
 *
 * Only the endpoint probe records a source-specific "we looked at this, then" today.
 * Registry and chain-registry freshness therefore stays `unknown` until a collector starts
 * writing its own check telemetry — an honest gap beats a convincing wrong answer.
 */
export function currentStateFreshness(row: {
  endpointCheckedAt?: string | null
  /** Accepted only so callers cannot quietly repurpose it; never read. */
  updatedAt?: string | Date | null
}): Record<string, string | null> {
  return { 'endpoint-probe': row.endpointCheckedAt ?? null }
}

/** Sources for which `checked_since` can currently be answered at all. */
export const SOURCES_WITH_CHECK_TELEMETRY: readonly string[] = ['endpoint-probe']
