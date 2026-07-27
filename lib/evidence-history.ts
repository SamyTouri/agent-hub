// Append-only evidence history — canonicalization, fingerprinting and change detection.
//
// The catalogue we already have answers "what is true right now". It cannot answer
// "what changed, when, and according to which source" — and that second question is the
// only one a buyer actually needs before paying. Every import so far overwrites: the
// registry sync replaces the description and the endpoint, the probe replaces the last
// availability state, the repository import replaces the last counter. The previous value
// is gone. This module is the other half: a ledger that keeps the replaced state.
//
// Two rules make it affordable, and they are the whole design:
//
//   1. An observation is written ONLY when the normalized fingerprint changes. A daily
//      JSON snapshot of ~17,500 subjects would be six million near-identical rows a year
//      and would prove nothing that the current-state row does not already prove.
//   2. Timestamps and counters are deliberately NOT part of the fingerprint. A probe that
//      finds the same host answering for the ninetieth day produces the same hash and
//      writes nothing. "When did we last look" is answered by the current-state record
//      (agents.metadata.endpoint_check, agents.updated_at); "what changed" is answered
//      here. Mixing the two would reintroduce the daily snapshot through the back door.
//
// Raw upstream pages are never stored. A long text is kept as a bounded excerpt PLUS the
// digest of its full normalized form, so an edit past the excerpt is still detected while
// storage stays proportional to the evidence, not to the page.

import { createHash } from 'node:crypto'
import { readStatus, type EndpointCheck } from './endpoint-probe.ts'

/** Bumped when the normalizers below change meaning. A bump is itself recorded as an
 *  observation so two fingerprints produced by different lenses are never silently
 *  compared as if they were the same measurement. */
export const EVIDENCE_SCHEMA_VERSION = 1

/**
 * Sources we currently attribute observations to. Kept as a union in code rather than a
 * database CHECK: a new source must be a deliberate code change, not a migration.
 *
 * The registry identifiers must match `agents.external_source` EXACTLY. Attribution is
 * the whole product: a fact imported from a chain registry that ends up labelled `native`
 * would claim we produced evidence we merely copied.
 */
export type EvidenceSource =
  | 'mcp-registry'
  | 'concordium-cis8004'
  | 'moltbook'
  | 'native'
  | 'endpoint-probe'
  | 'github-repository'

export type SubjectKind = 'agent' | 'mcp_server' | 'service'

/** Redistribution right of the row itself, decided at capture time. The access level of a
 *  reader decides how much SHAPE they see (summary vs full timeline); this decides whether
 *  the row may be shown at all. */
export type Visibility = 'public_summary' | 'paid' | 'private'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type EvidenceFacts = { [key: string]: JsonValue }

/** Excerpt kept in the facts for a free-text field. The digest covers the full text. */
export const FACT_EXCERPT_CHARS = 600
export const MAX_CHANGE_ENTRIES = 40
export const MAX_CHANGE_VALUE_CHARS = 240

// ---------------------------------------------------------------------------
// Canonicalization
// ---------------------------------------------------------------------------

/** Locale-independent key order. `localeCompare` would make the fingerprint depend on the
 *  machine's locale, which is exactly the kind of silent drift a ledger cannot afford. */
function compareKeys(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Strips what must not reach a fingerprint and rejects what cannot be reproduced.
 *
 * `undefined` and `null` are both removed so that "absent" and "explicitly empty" can
 * never produce two different hashes for the same reality. A removed field therefore
 * shows up in the diff as a removal, which is what a reader expects.
 */
export function normalizeFactValue(value: unknown, path = '$'): JsonValue | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value.normalize('NFC')
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`evidence facts: non-finite number at ${path}`)
    return value
  }
  if (Array.isArray(value)) {
    const items: JsonValue[] = []
    value.forEach((item, index) => {
      const normalized = normalizeFactValue(item, `${path}[${index}]`)
      if (normalized !== undefined) items.push(normalized)
    })
    return items
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`evidence facts: unsupported object at ${path}`)
    }
    const output: { [key: string]: JsonValue } = {}
    let kept = 0
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const normalized = normalizeFactValue((value as Record<string, unknown>)[key], `${path}.${key}`)
      if (normalized === undefined) continue
      output[key] = normalized
      kept++
    }
    return kept === 0 ? undefined : output
  }
  throw new Error(`evidence facts: unsupported ${typeof value} at ${path}`)
}

/** Normalized facts object, ready to store. Always an object, never null. */
export function canonicalFacts(facts: unknown): EvidenceFacts {
  const normalized = normalizeFactValue(facts)
  if (normalized === undefined) return {}
  if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error('evidence facts: the root value must be an object')
  }
  return normalized
}

/**
 * Deterministic JSON text.
 *
 * Written by hand rather than through `JSON.stringify`, because JavaScript reorders
 * integer-like object keys regardless of insertion order — a subject keyed `"2"` would
 * silently hash differently depending on how the object was built.
 */
export function canonicalJson(value: unknown): string {
  const normalized = normalizeFactValue(value)
  return serialize(normalized === undefined ? null : normalized)
}

function serialize(value: JsonValue): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`
  const keys = Object.keys(value).sort(compareKeys)
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(',')}}`
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Fingerprint of one measurement.
 *
 * The source and the schema version are inside the hash on purpose: the same facts read
 * from two different sources are two different claims, and the same facts read through
 * two different normalizers are two different measurements.
 */
export function contentHash(input: {
  source: string
  facts: unknown
  schemaVersion?: number
}): string {
  return sha256Hex(
    canonicalJson({
      v: input.schemaVersion ?? EVIDENCE_SCHEMA_VERSION,
      source: input.source,
      facts: input.facts,
    }),
  )
}

// ---------------------------------------------------------------------------
// Fact builders — one per source, each responsible for its own normalization
// ---------------------------------------------------------------------------

function collapseWhitespace(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed.length === 0 ? undefined : collapsed
}

function excerpt(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`
}

/** Case folding on scheme and host only. Everything after the host stays verbatim: a path
 *  is case-significant, and normalizing it away would hide a real endpoint move. */
export function normalizeEndpointUrl(value: string | null | undefined): string | undefined {
  const trimmed = collapseWhitespace(value)
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed)
    url.hash = ''
    return url.toString()
  } catch {
    return trimmed
  }
}

function normalizeProtocols(values: readonly string[] | null | undefined): string[] | undefined {
  if (!values) return undefined
  const unique = [...new Set(values.map((value) => collapseWhitespace(value)?.toLowerCase()).filter((value): value is string => Boolean(value)))]
  return unique.length === 0 ? undefined : unique.sort(compareKeys)
}

/**
 * What a directory entry claims about itself: name, description, where to reach it, which
 * protocols it speaks, where its source lives. This is the layer that moves most often and
 * where a silent rewrite matters most to a buyer.
 */
export function profileFacts(input: {
  displayName?: string | null
  description?: string | null
  endpoint?: string | null
  protocols?: readonly string[] | null
  repository?: string | null
  status?: string | null
  /**
   * Source-specific stable identifiers: an on-chain metadata hash, a token address, a
   * verification anchor. They belong in the fingerprint because a registry that silently
   * re-anchors an identity has changed something a buyer must be told about — arguably
   * more than a reworded description.
   */
  anchors?: Record<string, string | null | undefined>
}): EvidenceFacts {
  const description = collapseWhitespace(input.description)
  return canonicalFacts({
    anchors: input.anchors,
    display_name: collapseWhitespace(input.displayName),
    description: description === undefined ? undefined : excerpt(description, FACT_EXCERPT_CHARS),
    // The digest covers the WHOLE description, so an edit beyond the excerpt is still a
    // detected change. Storing the full text instead would turn the ledger into a mirror
    // of upstream content we have no right to redistribute.
    description_sha256: description === undefined ? undefined : sha256Hex(description),
    endpoint: normalizeEndpointUrl(input.endpoint),
    protocols: normalizeProtocols(input.protocols),
    repository: collapseWhitespace(input.repository),
    status: collapseWhitespace(input.status)?.toLowerCase(),
  })
}

function httpClass(status: number): string | undefined {
  if (!Number.isInteger(status) || status < 100 || status > 599) return undefined
  return `${Math.floor(status / 100)}xx`
}

/**
 * Availability, reduced to what is worth remembering.
 *
 * `checked_at`, `consecutive_failures` and `failing_since` are excluded on purpose: they
 * change on every single probe, so including them would write one row per subject per day
 * forever. What survives is the published ladder — responding, flaky, unreachable — plus
 * the coarse HTTP class, because a host that starts answering 5xx instead of 2xx is still
 * alive but no longer the same fact.
 */
export function availabilityFacts(check: EndpointCheck | null | undefined): EvidenceFacts {
  const status = readStatus(check)
  const httpStatus = check?.responded === true && typeof check.status === 'number' ? httpClass(check.status) : undefined
  return canonicalFacts({ state: status.kind, http_class: httpStatus })
}

// ---------------------------------------------------------------------------
// Change summary
// ---------------------------------------------------------------------------

export type FactChange = {
  path: string
  kind: 'added' | 'removed' | 'changed'
  from?: string
  to?: string
}

/** Values are rendered to bounded text. The change summary is a summary — it must never
 *  become a second copy of the payload it describes. */
function renderValue(value: JsonValue | undefined): string | undefined {
  if (value === undefined) return undefined
  const text = typeof value === 'string' ? value : serialize(value)
  return text.length <= MAX_CHANGE_VALUE_CHARS ? text : `${text.slice(0, MAX_CHANGE_VALUE_CHARS)}…`
}

function isPlainObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function walkDiff(
  before: JsonValue | undefined,
  after: JsonValue | undefined,
  path: string,
  out: FactChange[],
) {
  if (out.length >= MAX_CHANGE_ENTRIES) return
  if (before === undefined && after === undefined) return
  if (before === undefined) {
    out.push({ path, kind: 'added', to: renderValue(after) })
    return
  }
  if (after === undefined) {
    out.push({ path, kind: 'removed', from: renderValue(before) })
    return
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compareKeys)
    for (const key of keys) {
      walkDiff(before[key], after[key], path === '' ? key : `${path}.${key}`, out)
      if (out.length >= MAX_CHANGE_ENTRIES) return
    }
    return
  }
  // Arrays are compared as whole values: a per-index diff of a tag list reads as noise,
  // while "the protocol list went from one thing to another" reads as evidence.
  if (serialize(before) !== serialize(after)) {
    out.push({ path, kind: 'changed', from: renderValue(before), to: renderValue(after) })
  }
}

export function diffFacts(before: EvidenceFacts | null | undefined, after: EvidenceFacts): FactChange[] {
  if (!before) return []
  const changes: FactChange[] = []
  walkDiff(before, after, '', changes)
  if (changes.length >= MAX_CHANGE_ENTRIES) {
    changes.length = MAX_CHANGE_ENTRIES - 1
    changes.push({ path: '$truncated', kind: 'changed', to: `more than ${MAX_CHANGE_ENTRIES - 1} fields changed` })
  }
  return changes
}

// ---------------------------------------------------------------------------
// Observation planning
// ---------------------------------------------------------------------------

export type ObservationHead = {
  id: string
  contentHash: string
  schemaVersion: number
  facts: EvidenceFacts
  observedAt: string
}

export type ObservationInput = {
  subjectKind: SubjectKind
  /** Logical link to `agents.id`. Deliberately not a foreign key in the ledger: history
   *  about a subject must outlive the deletion of its current-state row. */
  subjectAgentId: string
  /** Identity string at observation time (the handle). Keeps the row readable, and keeps
   *  identity resolution auditable when a handle later moves. */
  subjectKey: string
  source: EvidenceSource
  sourceUrl?: string | null
  observedAt: string
  /** When the fact became true upstream, when the source tells us. Distinct from the
   *  moment we happened to look. */
  effectiveAt?: string | null
  facts: EvidenceFacts
  visibility: Visibility
  /** Which code path wrote the row — a cron, a script. Never exposed publicly. */
  collector: string
  schemaVersion?: number
}

export type ObservationRow = {
  subject_kind: SubjectKind
  subject_agent_id: string
  subject_key: string
  source: string
  source_url: string | null
  observed_at: string
  effective_at: string | null
  schema_version: number
  content_hash: string
  facts: EvidenceFacts
  previous_observation_id: string | null
  change_summary: FactChange[]
  visibility: Visibility
  collector: string
}

export type ObservationPlan =
  | { write: false; reason: 'unchanged' | 'out_of_order'; contentHash: string }
  | { write: true; reason: 'baseline' | 'changed' | 'schema_version'; contentHash: string; row: ObservationRow }

/**
 * Decides whether a measurement deserves a row.
 *
 * Pure on purpose: the dedup rule is the product promise ("we only write when something
 * changed"), so it has to be testable without a database, and the database enforces the
 * same rule again with a trigger in case a future caller forgets to ask.
 */
export function planObservation(
  head: ObservationHead | null | undefined,
  input: ObservationInput,
): ObservationPlan {
  const schemaVersion = input.schemaVersion ?? EVIDENCE_SCHEMA_VERSION
  const facts = canonicalFacts(input.facts)
  const hash = contentHash({ source: input.source, facts, schemaVersion })

  const row: ObservationRow = {
    subject_kind: input.subjectKind,
    subject_agent_id: input.subjectAgentId,
    subject_key: input.subjectKey,
    source: input.source,
    source_url: input.sourceUrl ?? null,
    observed_at: input.observedAt,
    effective_at: input.effectiveAt ?? null,
    schema_version: schemaVersion,
    content_hash: hash,
    facts,
    previous_observation_id: head?.id ?? null,
    change_summary: [],
    visibility: input.visibility,
    collector: input.collector,
  }

  if (!head) return { write: true, reason: 'baseline', contentHash: hash, row }
  if (head.contentHash === hash) return { write: false, reason: 'unchanged', contentHash: hash }
  // A ledger that accepts a backdated row stops being a chronology. The database refuses
  // it too; refusing here keeps the failure quiet in a cron instead of aborting a batch.
  if (Date.parse(input.observedAt) < Date.parse(head.observedAt)) {
    return { write: false, reason: 'out_of_order', contentHash: hash }
  }

  const changes = diffFacts(head.facts, facts)
  if (changes.length === 0) {
    // Same facts, different fingerprint: only a schema bump can do that. Say so, instead
    // of letting a reader believe the subject changed.
    row.change_summary = [
      {
        path: '$schema_version',
        kind: 'changed',
        from: String(head.schemaVersion),
        to: String(schemaVersion),
      },
    ]
    return { write: true, reason: 'schema_version', contentHash: hash, row }
  }

  row.change_summary = changes
  return { write: true, reason: 'changed', contentHash: hash, row }
}
