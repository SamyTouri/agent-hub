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
  planObservation,
  type EvidenceFacts,
  type EvidenceSource,
  type FactChange,
  type ObservationHead,
  type ObservationInput,
  type SubjectKind,
  type Visibility,
} from './evidence-history.ts'
import { COHORT_ID } from './evidence-cohort.ts'
import type { StoredObservation } from './evidence-timeline.ts'

/** Hard ceiling per call. The cohort is bounded by design; this is the backstop that keeps
 *  a future caller from turning the ledger into an unbounded write path. */
export const MAX_OBSERVATIONS_PER_RUN = 100

const UNDEFINED_TABLE = '42P01'
/** Refusals the ledger produces on purpose: a duplicate, a fork, a backdated row. They are
 *  a correct outcome of a race, not an incident. */
const LEDGER_REFUSALS = new Set(['23505', '23514', '23001'])

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

/** Provenance of a subject's own profile claims — its registry of origin, or us. */
export function provenanceSource(externalSource: string | null): EvidenceSource {
  switch (externalSource) {
    case 'mcp-registry':
      return 'mcp-registry'
    case 'concordium':
      return 'concordium'
    case 'moltbook':
      return 'moltbook'
    default:
      return 'native'
  }
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
  reason?: 'not_migrated' | 'error'
  considered: number
  written: number
  unchanged: number
  refused: number
  error?: string
}

const EMPTY_OUTCOME: AppendOutcome = { ok: true, considered: 0, written: 0, unchanged: 0, refused: 0 }

/**
 * Writes the observations that actually changed something, one statement at a time.
 *
 * The head map is updated in place as rows land, so several inputs for the same subject
 * and source inside one call chain correctly instead of all forking off the same parent.
 */
export async function appendObservations(sql: Sql, inputs: readonly ObservationInput[]): Promise<AppendOutcome> {
  if (inputs.length === 0) return { ...EMPTY_OUTCOME }
  const batch = inputs.slice(0, MAX_OBSERVATIONS_PER_RUN)

  const bySource = new Map<EvidenceSource, ObservationInput[]>()
  for (const input of batch) {
    const bucket = bySource.get(input.source)
    if (bucket) bucket.push(input)
    else bySource.set(input.source, [input])
  }

  const outcome: AppendOutcome = { ok: true, considered: batch.length, written: 0, unchanged: 0, refused: 0 }

  for (const [source, sourceInputs] of bySource) {
    const heads = await loadHeads(sql, source, [...new Set(sourceInputs.map((input) => input.subjectAgentId))])
    if (heads === null) return { ...outcome, ok: false, reason: 'not_migrated' }

    for (const input of sourceInputs) {
      const plan = planObservation(heads.get(input.subjectAgentId), input)
      if (!plan.write) {
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
        if (isMissingTable(error)) return { ...outcome, ok: false, reason: 'not_migrated' }
        if (LEDGER_REFUSALS.has(sqlState(error))) {
          outcome.refused++
          continue
        }
        return {
          ...outcome,
          ok: false,
          reason: 'error',
          error: error instanceof Error ? error.message.slice(0, 200) : 'append failed',
        }
      }
    }
  }

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
