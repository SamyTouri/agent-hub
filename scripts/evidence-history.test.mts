// Le journal de preuves n'a de valeur que si trois promesses tiennent littéralement :
// une même réalité produit toujours la même empreinte, une observation identique n'est
// jamais réécrite, et un document public ne contient jamais ce qui est payant. Ces trois
// promesses sont testées ici, sans base de données — parce qu'elles sont du raisonnement,
// pas de l'infrastructure. Le quatrième verrou (l'immuabilité) vit dans le moteur : on
// vérifie que la migration le pose bien.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  EVIDENCE_SCHEMA_VERSION,
  MAX_CHANGE_ENTRIES,
  MAX_CHANGE_VALUE_CHARS,
  availabilityFacts,
  canonicalFacts,
  canonicalJson,
  contentHash,
  diffFacts,
  normalizeEndpointUrl,
  planObservation,
  profileFacts,
  type EvidenceFacts,
  type ObservationHead,
  type ObservationInput,
} from '../lib/evidence-history.ts'
import { nextCheck, type EndpointCheck } from '../lib/endpoint-probe.ts'
import { buildCohortIndex, buildSubjectTimeline, type StoredObservation } from '../lib/evidence-timeline.ts'

const T1 = '2026-07-25T10:00:00.000Z'
const T2 = '2026-07-26T10:00:00.000Z'
const T3 = '2026-07-27T10:00:00.000Z'

// ---------------------------------------------------------------------------
// Canonicalisation
// ---------------------------------------------------------------------------

test('the fingerprint does not depend on the order fields were written in', () => {
  const a = { endpoint: 'https://example.test/mcp', display_name: 'Example', protocols: ['mcp'] }
  const b = { protocols: ['mcp'], display_name: 'Example', endpoint: 'https://example.test/mcp' }
  assert.equal(canonicalJson(a), canonicalJson(b))
  assert.equal(contentHash({ source: 'mcp-registry', facts: a }), contentHash({ source: 'mcp-registry', facts: b }))
})

test('integer-like keys are ordered by the serializer, not by JavaScript', () => {
  // JSON.stringify reorders "2" before "a" whatever the insertion order: relying on it
  // would silently change the fingerprint of a subject keyed with digits.
  const built: Record<string, unknown> = {}
  built['10'] = 'ten'
  built.a = 'letter'
  built['2'] = 'two'
  assert.equal(canonicalJson(built), '{"10":"ten","2":"two","a":"letter"}')
})

test('absent and explicitly empty are the same reality, so the same fingerprint', () => {
  assert.equal(canonicalJson({ endpoint: null, name: 'x' }), canonicalJson({ name: 'x' }))
  assert.equal(canonicalJson({ nested: { gone: null } }), canonicalJson({}))
})

test('array order is evidence and is never reordered', () => {
  assert.notEqual(canonicalJson({ steps: ['a', 'b'] }), canonicalJson({ steps: ['b', 'a'] }))
})

test('the same text written in two Unicode forms is one fact', () => {
  // Upstream sources disagree on normalization. Without NFC folding, an accented name
  // would look like it changed every time a registry re-encoded it.
  const composed = canonicalJson({ name: 'caf\u00e9' })
  const decomposed = canonicalJson({ name: 'cafe\u0301' })
  assert.notEqual('caf\u00e9', 'cafe\u0301', 'the two source strings must really differ')
  assert.equal(composed, decomposed)
})

test('what cannot be reproduced is refused rather than hashed', () => {
  for (const bad of [{ n: Number.NaN }, { n: Number.POSITIVE_INFINITY }, { d: new Date() }, { f: () => 1 }]) {
    assert.throws(() => canonicalJson(bad), /evidence facts/)
  }
})

test('the source and the schema version are part of the fingerprint', () => {
  const facts = { endpoint: 'https://example.test/' }
  const base = contentHash({ source: 'mcp-registry', facts })
  assert.notEqual(base, contentHash({ source: 'concordium-cis8004', facts }))
  assert.notEqual(base, contentHash({ source: 'mcp-registry', facts, schemaVersion: EVIDENCE_SCHEMA_VERSION + 1 }))
  assert.match(base, /^[a-f0-9]{64}$/)
})

// ---------------------------------------------------------------------------
// Fact builders
// ---------------------------------------------------------------------------

test('cosmetic rewrites of a description do not count as a change', () => {
  const a = profileFacts({ description: 'An   evidence\nlayer.' })
  const b = profileFacts({ description: 'An evidence layer.' })
  assert.deepEqual(a, b)
})

test('an edit beyond the stored excerpt is still detected', () => {
  const long = 'x'.repeat(2000)
  const a = profileFacts({ description: `${long}A` })
  const b = profileFacts({ description: `${long}B` })
  assert.equal(a.description, b.description, 'the excerpt is identical, which is exactly the trap')
  assert.notEqual(a.description_sha256, b.description_sha256)
  assert.ok(String(a.description).length < 1000, 'a raw page is never stored')
})

test('host casing is not a change, but the path is', () => {
  assert.equal(normalizeEndpointUrl('HTTPS://Example.TEST/mcp'), 'https://example.test/mcp')
  assert.notEqual(normalizeEndpointUrl('https://example.test/mcp'), normalizeEndpointUrl('https://example.test/MCP'))
  assert.equal(normalizeEndpointUrl('https://example.test/mcp#frag'), 'https://example.test/mcp')
  assert.equal(normalizeEndpointUrl('   '), undefined)
})

test('a silently re-anchored identity is a change, like any other', () => {
  // On-chain anchors are the strongest identity claim a registry makes. A directory that
  // quietly re-points a token or a metadata hash has changed something a buyer needs to
  // know — arguably more than a reworded description.
  const before = profileFacts({ displayName: 'Anchored', anchors: { metadata_hash: 'aa', token_address: 'tok-1' } })
  const after = profileFacts({ displayName: 'Anchored', anchors: { metadata_hash: 'bb', token_address: 'tok-1' } })
  assert.notEqual(
    contentHash({ source: 'concordium-cis8004', facts: before }),
    contentHash({ source: 'concordium-cis8004', facts: after }),
  )
  assert.deepEqual(diffFacts(before, after), [
    { path: 'anchors.metadata_hash', kind: 'changed', from: 'aa', to: 'bb' },
  ])
})

test('an absent anchor does not fabricate a field', () => {
  assert.deepEqual(profileFacts({ displayName: 'X' }), profileFacts({ displayName: 'X', anchors: { a: null } }))
})

test('protocol lists are compared as sets, not as orderings', () => {
  const a = profileFacts({ protocols: ['MCP', 'a2a', 'mcp'] })
  const b = profileFacts({ protocols: ['a2a', 'mcp'] })
  assert.deepEqual(a, b)
})

// ---------------------------------------------------------------------------
// Availability: transitions only
// ---------------------------------------------------------------------------

test('a probe repeated for months writes nothing new', () => {
  let check: EndpointCheck | null = null
  const hashes = new Set<string>()
  for (let day = 0; day < 90; day++) {
    check = nextCheck(check, { responded: true, status: 200 }, new Date(Date.UTC(2026, 0, day + 1)).toISOString())
    hashes.add(contentHash({ source: 'endpoint-probe', facts: availabilityFacts(check) }))
  }
  assert.equal(hashes.size, 1, 'ninety identical checks must be one single fingerprint')
})

test('the facts carry no timestamp and no counter — that is what makes dedup possible', () => {
  const check = nextCheck(nextCheck(null, { responded: false }, T1), { responded: false }, T2)
  const facts = availabilityFacts(check)
  assert.deepEqual(Object.keys(facts).sort(), ['state'])
  assert.equal(facts.state, 'unreachable')
})

test('every step of the published availability ladder is a distinct fact', () => {
  const responding = availabilityFacts(nextCheck(null, { responded: true, status: 200 }, T1))
  const flaky = availabilityFacts(nextCheck(null, { responded: false }, T1))
  const unreachable = availabilityFacts(nextCheck(nextCheck(null, { responded: false }, T1), { responded: false }, T2))
  const hashes = new Set(
    [responding, flaky, unreachable].map((facts) => contentHash({ source: 'endpoint-probe', facts })),
  )
  assert.equal(hashes.size, 3)
})

test('a host that keeps answering but starts erroring is not the same fact', () => {
  const ok = availabilityFacts(nextCheck(null, { responded: true, status: 200 }, T1))
  const erroring = availabilityFacts(nextCheck(null, { responded: true, status: 503 }, T2))
  assert.equal(ok.state, erroring.state)
  assert.notEqual(ok.http_class, erroring.http_class)
})

// ---------------------------------------------------------------------------
// Change summary
// ---------------------------------------------------------------------------

test('a change summary names what moved, in both directions', () => {
  const before = canonicalFacts({ endpoint: 'https://old.test/', display_name: 'Old', repository: 'https://github.com/a/b' })
  const after = canonicalFacts({ endpoint: 'https://new.test/', display_name: 'Old', status: 'deprecated' })
  const changes = diffFacts(before, after)
  assert.deepEqual(
    changes.map((change) => `${change.kind}:${change.path}`).sort(),
    ['added:status', 'changed:endpoint', 'removed:repository'],
  )
  const endpoint = changes.find((change) => change.path === 'endpoint')
  assert.equal(endpoint?.from, 'https://old.test/')
  assert.equal(endpoint?.to, 'https://new.test/')
})

test('a baseline has changed nothing and says so', () => {
  assert.deepEqual(diffFacts(null, canonicalFacts({ a: 1 })), [])
})

test('the summary stays a summary: long values are cut and the list is capped', () => {
  const before = canonicalFacts({ text: 'a'.repeat(5000) })
  const after = canonicalFacts({ text: 'b'.repeat(5000) })
  const [change] = diffFacts(before, after)
  assert.ok(String(change.from).length <= MAX_CHANGE_VALUE_CHARS + 1)

  const wide = (token: string) => canonicalFacts(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`f${i}`, token])))
  const many = diffFacts(wide('x'), wide('y'))
  assert.equal(many.length, MAX_CHANGE_ENTRIES)
  assert.equal(many[many.length - 1].path, '$truncated')
})

// ---------------------------------------------------------------------------
// Observation planning
// ---------------------------------------------------------------------------

function input(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    subjectKind: 'mcp_server',
    subjectAgentId: '11111111-1111-4111-8111-111111111111',
    subjectKey: 'io.github.example/server',
    source: 'mcp-registry',
    sourceUrl: 'https://registry.modelcontextprotocol.io/v0.1/servers',
    observedAt: T2,
    facts: profileFacts({ endpoint: 'https://example.test/mcp' }),
    visibility: 'public_summary',
    collector: 'test',
    ...overrides,
  }
}

function head(facts: EvidenceFacts, observedAt = T1, source = 'mcp-registry'): ObservationHead {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    contentHash: contentHash({ source, facts }),
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    facts,
    observedAt,
  }
}

test('the first observation of a subject is a baseline with no parent', () => {
  const plan = planObservation(null, input())
  assert.equal(plan.write, true)
  assert.equal(plan.reason, 'baseline')
  assert.equal(plan.write && plan.row.previous_observation_id, null)
  assert.deepEqual(plan.write && plan.row.change_summary, [])
})

test('an unchanged subject writes nothing at all', () => {
  const facts = profileFacts({ endpoint: 'https://example.test/mcp' })
  const plan = planObservation(head(facts), input({ facts }))
  assert.equal(plan.write, false)
  assert.equal(plan.reason, 'unchanged')
})

test('a real change is chained to the observation it replaces', () => {
  const before = profileFacts({ endpoint: 'https://example.test/mcp' })
  const plan = planObservation(head(before), input({ facts: profileFacts({ endpoint: 'https://moved.test/mcp' }) }))
  assert.equal(plan.write, true)
  assert.equal(plan.reason, 'changed')
  assert.equal(plan.write && plan.row.previous_observation_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  assert.equal(plan.write && plan.row.change_summary[0].path, 'endpoint')
})

test('a host that goes down, comes back and goes down again keeps all three transitions', () => {
  // A global uniqueness constraint on the fingerprint would silently drop the second
  // outage. Returning to a previous state is evidence, not a duplicate.
  const down = availabilityFacts(nextCheck(nextCheck(null, { responded: false }, T1), { responded: false }, T1))
  const up = availabilityFacts(nextCheck(null, { responded: true, status: 200 }, T2))
  const first = planObservation(head(up, T1, 'endpoint-probe'), input({ source: 'endpoint-probe', facts: down }))
  assert.equal(first.write, true)
  const back = planObservation(head(down, T2, 'endpoint-probe'), input({ source: 'endpoint-probe', facts: up, observedAt: T3 }))
  assert.equal(back.write, true)
  const again = planObservation(head(up, T3, 'endpoint-probe'), input({ source: 'endpoint-probe', facts: down, observedAt: T3 }))
  assert.equal(again.write, true, 'the second outage must be recordable')
})

test('a backdated observation is refused instead of corrupting the chronology', () => {
  const before = profileFacts({ endpoint: 'https://example.test/mcp' })
  const plan = planObservation(
    head(before, T3),
    input({ facts: profileFacts({ endpoint: 'https://other.test/mcp' }), observedAt: T1 }),
  )
  assert.equal(plan.write, false)
  assert.equal(plan.reason, 'out_of_order')
})

test('a normalizer bump is recorded as a normalizer bump, not as a subject change', () => {
  const facts = profileFacts({ endpoint: 'https://example.test/mcp' })
  const plan = planObservation(head(facts), input({ facts, schemaVersion: EVIDENCE_SCHEMA_VERSION + 1 }))
  assert.equal(plan.write, true)
  assert.equal(plan.reason, 'schema_version')
  assert.equal(plan.write && plan.row.change_summary[0].path, '$schema_version')
})

// ---------------------------------------------------------------------------
// Timeline: the public document must not contain the paid product
// ---------------------------------------------------------------------------

function observation(overrides: Partial<StoredObservation> = {}): StoredObservation {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    seq: 1,
    subjectKind: 'mcp_server',
    subjectKey: 'io.github.example/server',
    source: 'mcp-registry',
    sourceUrl: 'https://registry.modelcontextprotocol.io/v0.1/servers',
    observedAt: T1,
    effectiveAt: null,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    contentHash: 'c'.repeat(64),
    facts: profileFacts({ endpoint: 'https://example.test/mcp' }),
    previousObservationId: null,
    changeSummary: [],
    visibility: 'public_summary',
    collector: 'cron:registry',
    ...overrides,
  }
}

const SUBJECT = {
  handle: 'io.github.example/server',
  displayName: 'Example',
  subjectKind: 'mcp_server' as const,
  provenance: 'mcp-registry',
  cohort: null,
}

const CHANGED = observation({
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  seq: 2,
  observedAt: T2,
  previousObservationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  changeSummary: [{ path: 'endpoint', kind: 'changed', from: 'https://example.test/mcp', to: 'https://moved.test/mcp' }],
  facts: profileFacts({ endpoint: 'https://moved.test/mcp' }),
})

test('the public document says which field moved, never what it moved to', () => {
  const doc = buildSubjectTimeline({
    subject: SUBJECT,
    observations: [observation(), CHANGED],
    access: 'public',
    generatedAt: T3,
  })
  const serialized = JSON.stringify(doc)
  assert.ok(serialized.includes('endpoint'), 'the field that moved is public')
  assert.ok(!serialized.includes('https://example.test/mcp'), 'the replaced value is the paid product')
  assert.ok(!serialized.includes('c'.repeat(64)), 'fingerprints are collection internals')
  assert.equal(doc.timeline, undefined)
  assert.ok(Array.isArray(doc.recent_changes))
})

test('the paid document carries the exact before and after', () => {
  const doc = buildSubjectTimeline({
    subject: SUBJECT,
    observations: [observation(), CHANGED],
    access: 'paid',
    generatedAt: T3,
  })
  const serialized = JSON.stringify(doc)
  assert.ok(serialized.includes('https://example.test/mcp'))
  assert.ok(!serialized.includes('c'.repeat(64)), 'fingerprints stay private even for a paying reader')
  assert.equal((doc.timeline as unknown[]).length, 2)
})

test('a private observation stays invisible to a paying reader', () => {
  const secret = observation({
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    seq: 3,
    observedAt: T3,
    visibility: 'private',
    previousObservationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    changeSummary: [{ path: 'client_policy', kind: 'added', to: 'confidential' }],
  })
  const paid = JSON.stringify(
    buildSubjectTimeline({ subject: SUBJECT, observations: [observation(), CHANGED, secret], access: 'paid', generatedAt: T3 }),
  )
  assert.ok(!paid.includes('client_policy'))
  const priv = JSON.stringify(
    buildSubjectTimeline({ subject: SUBJECT, observations: [observation(), CHANGED, secret], access: 'private', generatedAt: T3 }),
  )
  assert.ok(priv.includes('client_policy'))
  assert.ok(priv.includes('c'.repeat(64)), 'the private level is the only one with the chain internals')
})

test('a baseline is never counted as a change', () => {
  const doc = buildSubjectTimeline({
    subject: SUBJECT,
    observations: [observation(), CHANGED],
    access: 'public',
    generatedAt: T3,
  })
  assert.deepEqual(doc.coverage, {
    observations: 2,
    changes: 1,
    first_observed_at: T1,
    last_observed_at: T2,
  })
})

test('the public document always states the method and the limits', () => {
  const doc = buildSubjectTimeline({ subject: SUBJECT, observations: [], access: 'public', generatedAt: T3 })
  assert.ok((doc.method as string[]).some((line) => /only when the normalized evidence.*changes/i.test(line)))
  assert.ok((doc.limits as string[]).some((line) => /absence of a change is not proof/i.test(line)))
  assert.deepEqual(doc.sources, [])
})

test('the cohort index is a summary, never the histories themselves', () => {
  const index = buildCohortIndex({
    cohortId: 'pilot-2026-07',
    entries: [{ subject: SUBJECT, observations: [observation(), CHANGED] }],
    access: 'public',
    generatedAt: T3,
  })
  const serialized = JSON.stringify(index)
  assert.ok(!serialized.includes('https://example.test/mcp'))
  assert.equal((index.subjects as Array<{ changes: number }>)[0].changes, 1)
})

// ---------------------------------------------------------------------------
// Immutability lives in the engine — check the migration actually installs it
// ---------------------------------------------------------------------------

const MIGRATION = readFileSync(new URL('../db/migration-evidence-history.sql', import.meta.url), 'utf8')
const SCHEMA = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')

test('the migration refuses updates, deletes and truncates at the engine level', () => {
  for (const sql of [MIGRATION, SCHEMA]) {
    assert.match(sql, /before update or delete on evidence_observations/i)
    assert.match(sql, /before truncate on evidence_observations/i)
    assert.match(sql, /evidence_observations is append-only/i)
  }
})

test('the ledger is not exposed through the auto-generated Data API', () => {
  for (const sql of [MIGRATION, SCHEMA]) {
    assert.match(sql, /alter table evidence_observations\s+enable row level security/i)
    assert.match(sql, /alter table evidence_cohort\s+enable row level security/i)
    assert.match(sql, /revoke all on table public\.evidence_observations\s+from anon, authenticated/i)
    assert.match(sql, /revoke all on table public\.evidence_cohort\s+from anon, authenticated/i)
    assert.ok(!/grant[^;]*\bupdate\b[^;]*on table public\.evidence_observations/i.test(sql), 'no write-back grant')
    assert.ok(!/grant[^;]*\bdelete\b[^;]*on table public\.evidence_observations/i.test(sql), 'no delete grant')
    // Belt and braces behind the trigger, which is what actually stops the production
    // role: grants and RLS do not restrict a table owner, triggers do.
    assert.match(sql, /revoke update, delete, truncate on table public\.evidence_observations/i)
  }
})

test('deduplication is enforced again in the database, not only in the collector', () => {
  for (const sql of [MIGRATION, SCHEMA]) {
    assert.match(sql, /identical consecutive observation refused/i)
    assert.match(sql, /must extend the current head, not fork it/i)
    assert.match(sql, /evidence_observations_baseline_unique/i)
    assert.match(sql, /evidence_observations_successor_unique/i)
    // A global uniqueness on the fingerprint would forbid recording a return to a
    // previous state, which is exactly the evidence a buyer needs.
    assert.ok(!/unique\s*\(\s*subject_agent_id\s*,\s*source\s*,\s*content_hash\s*\)/i.test(sql))
  }
})

test('deleting a profile never erases why we started tracking it', () => {
  for (const sql of [MIGRATION, SCHEMA]) {
    // A cascade from `agents` would have destroyed the selection rule and its reason at
    // the exact moment we would need to explain the choice.
    assert.ok(!/create table if not exists evidence_cohort[\s\S]*?on delete cascade/i.test(sql))
    assert.ok(!/agent_id\s+uuid primary key references agents/i.test(sql))
    assert.match(sql, /subject_key\s+text not null check \(char_length\(subject_key\)/i)
  }
})

test('the migration is additive: it never rewrites an existing table', () => {
  assert.ok(!/\bdrop table\b/i.test(MIGRATION))
  assert.ok(!/\balter table (agents|ratings|contributions|prepurchase_orders)\b/i.test(MIGRATION))
  assert.ok(!/\b(update|delete from) (agents|ratings)\b/i.test(MIGRATION))
})
