// Machine-readable timelines, and the line between what is public and what is not.
//
// Three access levels were ratified for this product, and this module is where they stop
// being a slide and become a data shape:
//
//   public  — method, provenance, current summary, which fields moved and when. Enough to
//             verify that we are doing what we claim, never enough to be the product.
//   paid    — the ordered history with the exact before/after of every change.
//   private — the collection internals: fingerprints, chain links, which job wrote what.
//
// The redaction is structural, not cosmetic. A public document cannot leak a diff value
// because it is never assembled with one: the paid entries are built in a branch the
// public path never enters. Two independent gates apply — the visibility recorded on each
// row (may this row be shown at all) and the reader's access level (how much shape they
// get) — so a row captured as private stays invisible even to a paying reader.

import type { EvidenceFacts, EvidenceSource, FactChange, SubjectKind, Visibility } from './evidence-history.ts'

export const TIMELINE_SCHEMA = 'https://agentreputation.dev/schemas/evidence-timeline/v1'

export type AccessLevel = 'public' | 'paid' | 'private'

const VISIBLE_AT: Record<AccessLevel, readonly Visibility[]> = {
  public: ['public_summary'],
  paid: ['public_summary', 'paid'],
  private: ['public_summary', 'paid', 'private'],
}

/** Said the same way everywhere: on the site, in the API, in a document handed to a
 *  prospective partner. A method that changes wording between audiences is not a method. */
export const METHOD_NOTES: readonly string[] = [
  'An observation is recorded only when the normalized evidence for a subject and a source changes.',
  'Identical repeat checks are deliberately not stored; the current-state record carries the date we last looked.',
  'Facts are normalized and fingerprinted; raw upstream pages are never stored or redistributed.',
  'Availability means the host answered, and nothing else — not that the service works, delivers or is honest.',
  'Nothing in this document is a score, a certification, or a ranking.',
]

export const LIMIT_NOTES: readonly string[] = [
  'History starts when we started tracking this subject, not when the subject started existing.',
  'A subject can change without any of our sources reporting it; absence of a change is not proof of stability.',
  'Identity across sources is asserted by us and can be wrong; corrections are published rather than silently applied.',
]

export const PAID_SURFACE_NOTES: readonly string[] = [
  'The complete ordered timeline with the exact before and after of every change.',
  'Change alerts and cross-source reconciliation.',
  'Fit against a supplied activation policy, and bulk or export access.',
]

export type StoredObservation = {
  id: string
  seq: number
  subjectKind: SubjectKind
  subjectKey: string
  source: EvidenceSource
  sourceUrl: string | null
  observedAt: string
  effectiveAt: string | null
  schemaVersion: number
  contentHash: string
  facts: EvidenceFacts
  previousObservationId: string | null
  changeSummary: FactChange[]
  visibility: Visibility
  collector: string
}

export type TimelineSubject = {
  handle: string
  displayName: string | null
  subjectKind: SubjectKind
  provenance: string
  cohort?: { id: string; stratum: string; selectionRule: string; selectionReason: string } | null
}

export type TimelineDocument = Record<string, unknown>

const bySeqAsc = (a: StoredObservation, b: StoredObservation) => a.seq - b.seq

function visibleTo(access: AccessLevel, observations: readonly StoredObservation[]): StoredObservation[] {
  const allowed = VISIBLE_AT[access]
  return observations.filter((observation) => allowed.includes(observation.visibility)).sort(bySeqAsc)
}

type SourceSummary = {
  source: string
  source_url: string | null
  first_observed_at: string
  last_observed_at: string
  last_effective_at: string | null
  observations: number
  changes: number
  current_state: EvidenceFacts
}

function summarizeSources(observations: readonly StoredObservation[]): SourceSummary[] {
  const grouped = new Map<string, StoredObservation[]>()
  for (const observation of observations) {
    const bucket = grouped.get(observation.source)
    if (bucket) bucket.push(observation)
    else grouped.set(observation.source, [observation])
  }
  return [...grouped.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([source, rows]) => {
      const head = rows[rows.length - 1]
      return {
        source,
        source_url: head.sourceUrl,
        first_observed_at: rows[0].observedAt,
        last_observed_at: head.observedAt,
        last_effective_at: head.effectiveAt,
        observations: rows.length,
        // A baseline is not a change. Counting it as one would inflate the only number
        // that is supposed to justify the whole ledger.
        changes: rows.filter((row) => row.previousObservationId !== null).length,
        current_state: head.facts,
      }
    })
}

/** Public shape: WHICH fields moved and when, never what they moved to. */
function publicChanges(observations: readonly StoredObservation[], limit: number) {
  return observations
    .filter((observation) => observation.previousObservationId !== null)
    .slice(-limit)
    .reverse()
    .map((observation) => ({
      observed_at: observation.observedAt,
      effective_at: observation.effectiveAt,
      source: observation.source,
      changed_fields: observation.changeSummary.map((change) => change.path),
    }))
}

export function buildSubjectTimeline(input: {
  subject: TimelineSubject
  observations: readonly StoredObservation[]
  access: AccessLevel
  generatedAt: string
  publicChangeLimit?: number
}): TimelineDocument {
  const observations = visibleTo(input.access, input.observations)
  const sources = summarizeSources(observations)

  const document: TimelineDocument = {
    schema: TIMELINE_SCHEMA,
    access: input.access,
    generated_at: input.generatedAt,
    subject: {
      handle: input.subject.handle,
      display_name: input.subject.displayName,
      subject_kind: input.subject.subjectKind,
      provenance: input.subject.provenance,
      cohort: input.subject.cohort
        ? {
            id: input.subject.cohort.id,
            stratum: input.subject.cohort.stratum,
            selection_rule: input.subject.cohort.selectionRule,
            selection_reason: input.subject.cohort.selectionReason,
          }
        : null,
    },
    method: METHOD_NOTES,
    limits: LIMIT_NOTES,
    coverage: {
      observations: observations.length,
      changes: observations.filter((observation) => observation.previousObservationId !== null).length,
      first_observed_at: observations[0]?.observedAt ?? null,
      last_observed_at: observations[observations.length - 1]?.observedAt ?? null,
    },
    sources,
  }

  if (input.access === 'public') {
    document.recent_changes = publicChanges(observations, input.publicChangeLimit ?? 10)
    document.paid_surface = { available: PAID_SURFACE_NOTES }
    return document
  }

  document.timeline = observations.map((observation) => {
    const entry: Record<string, unknown> = {
      observed_at: observation.observedAt,
      effective_at: observation.effectiveAt,
      source: observation.source,
      source_url: observation.sourceUrl,
      subject_key: observation.subjectKey,
      baseline: observation.previousObservationId === null,
      changes: observation.changeSummary,
      facts: observation.facts,
    }
    if (input.access === 'private') {
      entry.id = observation.id
      entry.seq = observation.seq
      entry.content_hash = observation.contentHash
      entry.previous_observation_id = observation.previousObservationId
      entry.schema_version = observation.schemaVersion
      entry.visibility = observation.visibility
      entry.collector = observation.collector
    }
    return entry
  })

  document.redistribution = {
    public: false,
    note:
      input.access === 'private'
        ? 'Private document: collection internals included. Never attach to a public page, an issue or an email.'
        : 'Paid document: the full change history is the product. Do not publish it as a public example.',
  }
  return document
}

export type CohortIndexEntry = {
  subject: TimelineSubject
  observations: readonly StoredObservation[]
}

/**
 * A single machine-readable object covering the whole cohort — the shape an agent would
 * actually query before deciding whether a capability may be activated.
 */
export function buildCohortIndex(input: {
  cohortId: string
  entries: readonly CohortIndexEntry[]
  access: AccessLevel
  generatedAt: string
}): TimelineDocument {
  const subjects = input.entries.map((entry) => {
    const observations = visibleTo(input.access, entry.observations)
    const changes = observations.filter((observation) => observation.previousObservationId !== null)
    return {
      handle: entry.subject.handle,
      subject_kind: entry.subject.subjectKind,
      provenance: entry.subject.provenance,
      stratum: entry.subject.cohort?.stratum ?? null,
      observations: observations.length,
      changes: changes.length,
      first_observed_at: observations[0]?.observedAt ?? null,
      last_change_at: changes[changes.length - 1]?.observedAt ?? null,
      sources: [...new Set(observations.map((observation) => observation.source))].sort(),
    }
  })

  return {
    schema: TIMELINE_SCHEMA,
    access: input.access,
    generated_at: input.generatedAt,
    cohort: {
      id: input.cohortId,
      subjects: subjects.length,
      note:
        'A deliberately bounded pilot cohort chosen to test attribution and change detection. ' +
        'It is not a coverage target and not a ranking.',
    },
    method: METHOD_NOTES,
    limits: LIMIT_NOTES,
    subjects: subjects.sort((a, b) => (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0)),
  }
}
