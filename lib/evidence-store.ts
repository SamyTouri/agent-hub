// Persistence for the evidence ledger — deliberately the thinnest layer in the feature.
//
// Everything that decides anything lives in the pure modules next door and is tested
// without a database. What is left here is the part that must obey the two operational
// constraints this project has paid for twice already:
//
//   - Supabase runs behind a transaction pooler with a single connection. Queries are
//     sequential, always. A `Promise.all` of two statements pipelines and hangs until the
//     statement timeout, taking the whole cron with it.
//   - A table that does not exist yet must not break production. The migration is applied
//     by a human, after the code ships; until then every call here degrades to
//     "not migrated" and the surrounding job finishes normally. That is why the missing
//     table is matched on the SQL state code rather than swallowed with a bare catch:
//     a real failure still has to be visible.

import type { Sql } from './db.ts'
import type { EndpointCheck } from './endpoint-probe.ts'
import {
  EVIDENCE_SCHEMA_VERSION,
  availabilityFacts,
  planObservation,
  profileFacts,
  type EvidenceFacts,
  type EvidenceSource,
  type FactChange,
  type ObservationHead,
  type ObservationInput,
  type SubjectKind,
  type Visibility,
} from './evidence-history.ts'
import { COHORT_ID, hasFieldCollector } from './evidence-cohort.ts'
import type { StoredObservation } from './evidence-timeline.ts'

/** Hard ceiling per call. The cohort is bounded by design; this is the backstop that keeps
 *  a future caller from turning the ledger into an unbounded write path. */
export const MAX_OBSERVATIONS_PER_RUN = 100

const UNDEFINED_TABLE = '42P01'

/**
 * The ONLY refusal that is routine: another writer reached the same point of the chain
 * first. Both partial unique indexes and the trigger's "baseline already exists" /
 * "identical consecutive observation" raise it, and all three mean the same benign thing
 * — the row we wanted is already there.
 */
const CONCURRENT_CONFLICT = '23505'

/**
 * A chain violation is never routine. It means our idea of the head was wrong: a fork, a
 * parent belonging to another subject, or an observation dated before the one it extends.
 * Swallowing it as constraint noise would let the ledger drift while every job reports
 * success — the exact failure mode an append-only design exists to prevent.
 */
const CHAIN_VIOLATION = '23514'

function sqlState(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

export function isMissingTable(error: unknown): boolean {
  return sqlState(error) === UNDEFINED_TABLE
}

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function iso(value: unknown, fallback: string): string {
  return isoOrNull(value) ?? fallback
}

export type CohortMember = {
  agentId: string
  handle: string
  displayName: string | null
  description: string
  subjectKind: SubjectKind
  stratum: string
  selectionRule: string
  selectionReason: string
  externalSource: string | null
  externalId: string | null
  endpoint: string | null
  repository: string | null
  protocols: string[]
  endpointCheck: EndpointCheck | null
}

/**
 * Provenance of a subject's own profile claims — its registry of origin, or us.
 *
 * Throws on an unrecognised registry instead of falling back to `native`. A silent
 * fallback is the worst available failure: it would sign someone else's imported claim
 * with our own name. The throw only reaches the operator commands, where refusing to
 * attribute a fact is the correct behaviour and the fix is one line here.
 */
export function provenanceSource(externalSource: string | null): EvidenceSource {
  if (externalSource === null || externalSource === '') return 'native'
  switch (externalSource) {
    case 'mcp-registry':
      return 'mcp-registry'
    // Must match lib/concordium-sync.ts SOURCE exactly.
    case 'concordium-cis8004':
      return 'concordium-cis8004'
    case 'moltbook':
      return 'moltbook'
    default:
      throw new Error(
        `unknown provenance "${externalSource}": add it to EvidenceSource before observing this subject`,
      )
  }
}

/** Written on every row the operator baseline command produces. */
export const BASELINE_COLLECTOR = 'script:evidence-cohort'

export type BaselinePlan = {
  /** Profile chains the manual baseline may start. */
  profiles: ObservationInput[]
  /** Availability chains the manual baseline may start. */
  availability: ObservationInput[]
  /** Subjects left to their own importer, counted by provenance. Reported, never silent. */
  deferredProfiles: Record<string, number>
}

/**
 * What a manual baseline is allowed to write — pure, so the rule is testable without a
 * database and reviewable without running anything.
 *
 * A profile chain has exactly one author. Where an importer already appends profile
 * observations, that importer is it: the baseline reads the stored catalogue row while the
 * importer reads the fresh upstream payload, and for Concordium the row cannot even hold
 * what the importer records (the on-chain anchors live nowhere in `agents`). Writing our
 * poorer reading first would make the importer's first append diff against it and publish
 * "anchors added" — a change that never happened at the vendor, permanent in an append-only
 * ledger. So those subjects are deferred, and the deferral is counted rather than implied.
 *
 * Availability is the opposite case and stays: both readings come from the same probe
 * through the same reducer, so the baseline is that collector's own last measurement rather
 * than a competing view of it. Provenances with no importer keep their manual baseline too
 * — for them the alternative is no history at all.
 *
 * Throws on an unrecognised provenance, through `provenanceSource`: refusing to attribute
 * beats signing someone else's claim with our name.
 */
export function planBaselineObservations(
  cohort: readonly CohortMember[],
  observedAt: string,
): BaselinePlan {
  const plan: BaselinePlan = { profiles: [], availability: [], deferredProfiles: {} }

  for (const member of cohort) {
    const common = {
      subjectKind: member.subjectKind,
      subjectAgentId: member.agentId,
      subjectKey: member.handle,
      sourceUrl: member.endpoint,
      observedAt,
      effectiveAt: null,
      visibility: 'public_summary' as const,
      collector: BASELINE_COLLECTOR,
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
    }

    if (hasFieldCollector(member.externalSource)) {
      const provenance = provenanceSource(member.externalSource)
      plan.deferredProfiles[provenance] = (plan.deferredProfiles[provenance] ?? 0) + 1
    } else {
      plan.profiles.push({
        ...common,
        source: provenanceSource(member.externalSource),
        facts: profileFacts({
          displayName: member.displayName,
          description: member.description,
          endpoint: member.endpoint,
          protocols: member.protocols,
          repository: member.repository,
        }),
      })
    }

    // No probe has run yet: there is no measurement to record, and inventing one would be
    // the same mistake in a different chain.
    if (!member.endpointCheck?.checked_at) continue
    plan.availability.push({
      ...common,
      source: 'endpoint-probe',
      facts: availabilityFacts(member.endpointCheck),
    })
  }

  return plan
}

/**
 * The tracked cohort, joined to its current catalogue state.
 *
 * Returns null — not an empty array — when the ledger has not been migrated yet, so a
 * caller can tell "nothing to observe" apart from "this feature is not live".
 */
export async function loadActiveCohort(sql: Sql, cohortId = COHORT_ID): Promise<CohortMember[] | null> {
  try {
    const rows = await sql`
      select
        c.agent_id, c.stratum, c.selection_rule, c.selection_reason, c.subject_kind,
        a.handle, a.display_name, a.description, a.external_source, a.external_id,
        a.endpoint, a.protocols,
        a.metadata->>'repo'          as repository,
        a.metadata->'endpoint_check' as endpoint_check
      from evidence_cohort c
      join agents a on a.id = c.agent_id
      where c.active and c.cohort = ${cohortId}
      order by a.handle
      limit ${MAX_OBSERVATIONS_PER_RUN}
    `
    return rows.map((row) => ({
      agentId: String(row.agent_id),
      handle: String(row.handle),
      displayName: (row.display_name as string | null) ?? null,
      description: String(row.description ?? ''),
      subjectKind: (row.subject_kind as SubjectKind) ?? 'agent',
      stratum: String(row.stratum),
      selectionRule: String(row.selection_rule),
      selectionReason: String(row.selection_reason),
      externalSource: (row.external_source as string | null) ?? null,
      externalId: (row.external_id as string | null) ?? null,
      endpoint: (row.endpoint as string | null) ?? null,
      repository: (row.repository as string | null) ?? null,
      protocols: (row.protocols as string[] | null) ?? [],
      endpointCheck: (row.endpoint_check as EndpointCheck | null) ?? null,
    }))
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

/** Current head of each subject's chain for one source — one query for the whole cohort. */
export async function loadHeads(
  sql: Sql,
  source: EvidenceSource,
  subjectIds: readonly string[],
): Promise<Map<string, ObservationHead> | null> {
  if (subjectIds.length === 0) return new Map()
  try {
    const rows = await sql`
      select distinct on (subject_agent_id)
        subject_agent_id, id, content_hash, schema_version, facts, observed_at
      from evidence_observations
      where source = ${source} and subject_agent_id = any(${[...subjectIds]}::uuid[])
      order by subject_agent_id, seq desc
    `
    const heads = new Map<string, ObservationHead>()
    for (const row of rows) {
      heads.set(String(row.subject_agent_id), {
        id: String(row.id),
        contentHash: String(row.content_hash),
        schemaVersion: Number(row.schema_version),
        facts: (row.facts as EvidenceFacts) ?? {},
        observedAt: iso(row.observed_at, new Date(0).toISOString()),
      })
    }
    return heads
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

export type AppendOutcome = {
  ok: boolean
  reason?: 'not_migrated' | 'chain_defect' | 'deadline' | 'error'
  considered: number
  written: number
  unchanged: number
  /** Initialization-only mode: a chain already exists for this subject and source. */
  skipped: number
  /** Another writer got there first. Expected under concurrency, not a problem. */
  conflicts: number
  /** Stale head, fork, wrong parent or backdated observation. Never routine. */
  defects: number
  error?: string
}

const EMPTY_OUTCOME: AppendOutcome = {
  ok: true,
  considered: 0,
  written: 0,
  unchanged: 0,
  skipped: 0,
  conflicts: 0,
  defects: 0,
}

export type AppendOptions = {
  /**
   * Only start chains, never extend one. Used by the baseline command: the crons derive
   * their chains from the fresh upstream payload, while the baseline derives them from
   * the stored catalogue row. Letting the second one extend a chain built by the first
   * would manufacture immutable changes out of two different readings of the same
   * reality — and immutable means unfixable.
   */
  initializeOnly?: boolean
  /** Wall-clock stop, checked before every statement. */
  deadlineAt?: number
}

/**
 * Writes the observations that actually changed something, one statement at a time.
 *
 * The head map is updated in place as rows land, so several inputs for the same subject
 * and source inside one call chain correctly instead of all forking off the same parent.
 */
export async function appendObservations(
  sql: Sql,
  inputs: readonly ObservationInput[],
  options: AppendOptions = {},
): Promise<AppendOutcome> {
  if (inputs.length === 0) return { ...EMPTY_OUTCOME }
  const batch = inputs.slice(0, MAX_OBSERVATIONS_PER_RUN)
  const outOfTime = () => options.deadlineAt !== undefined && Date.now() >= options.deadlineAt

  const bySource = new Map<EvidenceSource, ObservationInput[]>()
  for (const input of batch) {
    const bucket = bySource.get(input.source)
    if (bucket) bucket.push(input)
    else bySource.set(input.source, [input])
  }

  const outcome: AppendOutcome = { ...EMPTY_OUTCOME, considered: batch.length }
  const fail = (reason: AppendOutcome['reason'], error?: string): AppendOutcome => ({
    ...outcome,
    ok: false,
    reason,
    ...(error === undefined ? {} : { error }),
  })

  for (const [source, sourceInputs] of bySource) {
    if (outOfTime()) return fail('deadline')
    const heads = await loadHeads(sql, source, [...new Set(sourceInputs.map((input) => input.subjectAgentId))])
    if (heads === null) return fail('not_migrated')

    for (const input of sourceInputs) {
      if (outOfTime()) return fail('deadline')
      const head = heads.get(input.subjectAgentId)
      if (options.initializeOnly && head) {
        outcome.skipped++
        continue
      }
      const plan = planObservation(head, input)
      if (!plan.write) {
        if (plan.reason === 'out_of_order') {
          // Not "unchanged": the collector tried to date an observation before the one it
          // extends. Counting it as a no-op would hide a broken clock or a stale head.
          outcome.defects++
          outcome.error ??= `out_of_order: ${input.source} ${input.subjectKey}`
          continue
        }
        outcome.unchanged++
        continue
      }
      const row = plan.row
      try {
        const [inserted] = await sql`
          insert into evidence_observations (
            subject_kind, subject_agent_id, subject_key, source, source_url,
            observed_at, effective_at, schema_version, content_hash, facts,
            previous_observation_id, change_summary, visibility, collector
          ) values (
            ${row.subject_kind}, ${row.subject_agent_id}::uuid, ${row.subject_key}, ${row.source}, ${row.source_url},
            ${row.observed_at}::timestamptz, ${row.effective_at}::timestamptz, ${row.schema_version},
            ${row.content_hash}, ${sql.json(row.facts)}::jsonb,
            ${row.previous_observation_id}::uuid, ${sql.json(row.change_summary)}::jsonb,
            ${row.visibility}, ${row.collector}
          )
          returning id
        `
        heads.set(input.subjectAgentId, {
          id: String(inserted.id),
          contentHash: row.content_hash,
          schemaVersion: row.schema_version,
          facts: row.facts,
          observedAt: row.observed_at,
        })
        outcome.written++
      } catch (error) {
        if (isMissingTable(error)) return fail('not_migrated')
        const message = error instanceof Error ? error.message.slice(0, 200) : 'append failed'
        if (sqlState(error) === CONCURRENT_CONFLICT) {
          outcome.conflicts++
          continue
        }
        if (sqlState(error) === CHAIN_VIOLATION) {
          // Keep going so one broken subject does not blind us to the other forty-nine,
          // but the run is NOT ok and the first violation is reported verbatim.
          outcome.defects++
          outcome.error ??= `chain_violation: ${input.source} ${input.subjectKey}: ${message}`
          continue
        }
        return fail('error', message)
      }
    }
  }

  if (outcome.defects > 0) return { ...outcome, ok: false, reason: 'chain_defect' }
  return outcome
}

/** Full chain for one subject, oldest first — the raw material of a timeline document. */
export async function loadSubjectObservations(sql: Sql, subjectAgentId: string): Promise<StoredObservation[] | null> {
  try {
    const rows = await sql`
      select
        id, seq, subject_kind, subject_key, source, source_url, observed_at, effective_at,
        schema_version, content_hash, facts, previous_observation_id, change_summary,
        visibility, collector
      from evidence_observations
      where subject_agent_id = ${subjectAgentId}::uuid
      order by seq asc
    `
    return rows.map((row) => ({
      id: String(row.id),
      seq: Number(row.seq),
      subjectKind: row.subject_kind as SubjectKind,
      subjectKey: String(row.subject_key),
      source: row.source as EvidenceSource,
      sourceUrl: (row.source_url as string | null) ?? null,
      observedAt: iso(row.observed_at, new Date(0).toISOString()),
      effectiveAt: isoOrNull(row.effective_at),
      schemaVersion: Number(row.schema_version),
      contentHash: String(row.content_hash),
      facts: (row.facts as EvidenceFacts) ?? {},
      previousObservationId: (row.previous_observation_id as string | null) ?? null,
      changeSummary: (row.change_summary as FactChange[] | null) ?? [],
      visibility: row.visibility as Visibility,
      collector: String(row.collector),
    }))
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}
