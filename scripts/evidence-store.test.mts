// Le verrou qui a bloqué la mise en service : le socle ne doit JAMAIS prolonger une
// chaîne déjà commencée. Le socle lit la fiche stockée, les crons lisent la charge utile
// fraîche du fournisseur — deux lectures de la même réalité qui ne coïncident jamais
// exactement. Sans ce verrou, relancer la commande d'amorçage inventait un « changement »
// qui n'a jamais eu lieu chez le vendeur, et le journal étant immuable, cette fausse
// preuve devenait définitive.
//
// Les tests ci-dessous branchent la couche de persistance sur un faux client SQL en
// mémoire. Ils ne touchent aucune base, ne sautent jamais, et couvrent ce que le test
// transactionnel PostgreSQL de l'orchestrateur ne voit pas : la décision côté collecteur.
import assert from 'node:assert/strict'
import test from 'node:test'

import type { Sql } from '../lib/db.ts'
import {
  BASELINE_COLLECTOR,
  appendObservations,
  planBaselineObservations,
  provenanceSource,
  type CohortMember,
} from '../lib/evidence-store.ts'
import {
  EVIDENCE_SCHEMA_VERSION,
  contentHash,
  diffFacts,
  profileFacts,
  type EvidenceFacts,
  type ObservationInput,
} from '../lib/evidence-history.ts'
import { PROVENANCES_WITH_FIELD_COLLECTOR, hasFieldCollector } from '../lib/evidence-cohort.ts'
import { nextCheck } from '../lib/endpoint-probe.ts'

const SUBJECT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const T1 = '2026-07-25T10:00:00.000Z'
const T2 = '2026-07-26T10:00:00.000Z'

type StoredHead = { subject: string; source: string; facts: EvidenceFacts; observedAt: string }

type Inserted = { subjectKey: string; source: string; contentHash: string; previous: string | null }

/**
 * Faux client postgres.js : juste assez pour distinguer la lecture des têtes de chaîne de
 * l'insertion, et pour rejouer une erreur SQLSTATE donnée. Volontairement minimal — dès
 * qu'il en ferait plus, il testerait lui-même au lieu de tester le code.
 */
function ledger(options: { heads?: StoredHead[]; failInsertWith?: string } = {}) {
  const inserted: Inserted[] = []
  let nextId = 0
  const call = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(' ? ')
    if (text.includes('insert into evidence_observations')) {
      if (options.failInsertWith) {
        return Promise.reject(Object.assign(new Error('simulated'), { code: options.failInsertWith }))
      }
      nextId += 1
      inserted.push({
        subjectKey: String(values[2]),
        source: String(values[3]),
        contentHash: String(values[8]),
        previous: (values[10] as string | null) ?? null,
      })
      return Promise.resolve([{ id: `inserted-${nextId}` }])
    }
    if (text.includes('from evidence_observations')) {
      const source = values[0] as string
      const ids = values[1] as string[]
      return Promise.resolve(
        (options.heads ?? [])
          .filter((head) => head.source === source && ids.includes(head.subject))
          .map((head) => ({
            subject_agent_id: head.subject,
            id: `head-${head.subject}`,
            content_hash: contentHash({ source: head.source, facts: head.facts }),
            schema_version: EVIDENCE_SCHEMA_VERSION,
            facts: head.facts,
            observed_at: head.observedAt,
          })),
      )
    }
    return Promise.resolve([])
  }
  const sql = call as unknown as Sql
  ;(sql as unknown as { json: (value: unknown) => unknown }).json = (value) => value
  return { sql, inserted }
}

function input(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    subjectKind: 'mcp_server',
    subjectAgentId: SUBJECT,
    subjectKey: 'io.github.example/server',
    source: 'mcp-registry',
    sourceUrl: null,
    observedAt: T2,
    facts: profileFacts({ endpoint: 'https://example.test/mcp' }),
    visibility: 'public_summary',
    collector: 'test',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Initialization-only: the release blocker
// ---------------------------------------------------------------------------

test('the baseline starts a chain when there is none', async () => {
  const { sql, inserted } = ledger()
  const outcome = await appendObservations(sql, [input()], { initializeOnly: true })
  assert.equal(outcome.written, 1)
  assert.equal(outcome.skipped, 0)
  assert.equal(inserted[0].previous, null, 'a baseline has no parent')
})

test('the baseline never extends a chain a collector already started', async () => {
  // The stored catalogue row and the fresh upstream payload disagree — the normal case,
  // not an edge case. Extending here would write a change that never happened.
  const { sql, inserted } = ledger({
    heads: [{ subject: SUBJECT, source: 'mcp-registry', facts: profileFacts({ endpoint: 'https://moved.test/mcp' }), observedAt: T1 }],
  })
  const outcome = await appendObservations(sql, [input()], { initializeOnly: true })
  assert.equal(outcome.written, 0)
  assert.equal(outcome.skipped, 1)
  assert.deepEqual(inserted, [], 'nothing may reach the immutable ledger')
})

test('the baseline still starts chains for subjects added since the last run', async () => {
  const { sql, inserted } = ledger({
    heads: [{ subject: SUBJECT, source: 'mcp-registry', facts: profileFacts({ endpoint: 'https://a.test/' }), observedAt: T1 }],
  })
  const outcome = await appendObservations(
    sql,
    [input(), input({ subjectAgentId: OTHER, subjectKey: 'io.github.example/new' })],
    { initializeOnly: true },
  )
  assert.equal(outcome.skipped, 1)
  assert.equal(outcome.written, 1)
  assert.equal(inserted[0].subjectKey, 'io.github.example/new')
})

test('without the flag, a collector still extends its own chain', async () => {
  const { sql, inserted } = ledger({
    heads: [{ subject: SUBJECT, source: 'mcp-registry', facts: profileFacts({ endpoint: 'https://old.test/' }), observedAt: T1 }],
  })
  const outcome = await appendObservations(sql, [input()])
  assert.equal(outcome.written, 1)
  assert.equal(inserted[0].previous, `head-${SUBJECT}`)
})

test('an unchanged subject writes nothing in either mode', async () => {
  const facts = profileFacts({ endpoint: 'https://example.test/mcp' })
  for (const options of [{}, { initializeOnly: true }]) {
    const { sql, inserted } = ledger({ heads: [{ subject: SUBJECT, source: 'mcp-registry', facts, observedAt: T1 }] })
    const outcome = await appendObservations(sql, [input({ facts })], options)
    assert.equal(outcome.written, 0)
    assert.deepEqual(inserted, [])
  }
})

// ---------------------------------------------------------------------------
// A chain defect is not constraint noise
// ---------------------------------------------------------------------------

test('a concurrent duplicate is routine and does not fail the run', async () => {
  const { sql } = ledger({ failInsertWith: '23505' })
  const outcome = await appendObservations(sql, [input()])
  assert.equal(outcome.ok, true)
  assert.equal(outcome.conflicts, 1)
  assert.equal(outcome.defects, 0)
})

test('a fork or a wrong parent surfaces as a defect, never as noise', async () => {
  const { sql } = ledger({ failInsertWith: '23514' })
  const outcome = await appendObservations(sql, [input()])
  assert.equal(outcome.ok, false)
  assert.equal(outcome.reason, 'chain_defect')
  assert.equal(outcome.defects, 1)
  assert.match(String(outcome.error), /chain_violation/)
})

test('a backdated observation is a defect, not a no-op', async () => {
  // Counting it as "unchanged" would hide a stale head or a broken clock behind a run
  // that reports success.
  const { sql, inserted } = ledger({
    heads: [{ subject: SUBJECT, source: 'mcp-registry', facts: profileFacts({ endpoint: 'https://old.test/' }), observedAt: T2 }],
  })
  const outcome = await appendObservations(sql, [input({ observedAt: T1 })])
  assert.equal(outcome.ok, false)
  assert.equal(outcome.defects, 1)
  assert.equal(outcome.unchanged, 0)
  assert.match(String(outcome.error), /out_of_order/)
  assert.deepEqual(inserted, [])
})

test('one broken subject does not blind the run to the others', async () => {
  const { sql } = ledger({
    heads: [{ subject: SUBJECT, source: 'mcp-registry', facts: profileFacts({ endpoint: 'https://old.test/' }), observedAt: T2 }],
  })
  const outcome = await appendObservations(sql, [
    input({ observedAt: T1 }),
    input({ subjectAgentId: OTHER, subjectKey: 'io.github.example/other' }),
  ])
  assert.equal(outcome.defects, 1)
  assert.equal(outcome.written, 1, 'the healthy subject is still recorded')
  assert.equal(outcome.ok, false, 'but the run is not reported as clean')
})

test('a missing table degrades instead of failing the surrounding job', async () => {
  const rejecting = (() => Promise.reject(Object.assign(new Error('no table'), { code: '42P01' }))) as unknown as Sql
  ;(rejecting as unknown as { json: (v: unknown) => unknown }).json = (v) => v
  const outcome = await appendObservations(rejecting, [input()])
  assert.equal(outcome.ok, false)
  assert.equal(outcome.reason, 'not_migrated')
})

// ---------------------------------------------------------------------------
// The deadline is a real stop, not a loop guard
// ---------------------------------------------------------------------------

test('an expired deadline stops before touching the database', async () => {
  const { sql, inserted } = ledger()
  const outcome = await appendObservations(sql, [input()], { deadlineAt: Date.now() - 1 })
  assert.equal(outcome.ok, false)
  assert.equal(outcome.reason, 'deadline')
  assert.deepEqual(inserted, [])
})

test('a generous deadline does not interfere', async () => {
  const { sql } = ledger()
  const outcome = await appendObservations(sql, [input()], { deadlineAt: Date.now() + 60_000 })
  assert.equal(outcome.ok, true)
  assert.equal(outcome.written, 1)
})

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

test('a subject imported from a registry is never signed with our own name', () => {
  // The Concordium importer writes external_source = 'concordium-cis8004'. A lookup table
  // that only knew 'concordium' silently attributed those subjects to us.
  assert.equal(provenanceSource('concordium-cis8004'), 'concordium-cis8004')
  assert.equal(provenanceSource('mcp-registry'), 'mcp-registry')
  assert.equal(provenanceSource('moltbook'), 'moltbook')
  assert.equal(provenanceSource(null), 'native')
  assert.equal(provenanceSource(''), 'native')
})

test('an unknown registry refuses attribution instead of guessing', () => {
  assert.throws(() => provenanceSource('some-new-registry'), /unknown provenance/)
})

test('a cohort member keeps the provenance it was imported with', () => {
  assert.equal(provenanceSource(member().externalSource), 'concordium-cis8004')
})

// ---------------------------------------------------------------------------
// One author per profile chain — the last pre-activation blocker
// ---------------------------------------------------------------------------

const PROBED = nextCheck(null, { responded: true, status: 200 }, T1)

function member(overrides: Partial<CohortMember> = {}): CohortMember {
  return {
    agentId: SUBJECT,
    handle: 'cis8004.ccd-7',
    displayName: 'Anchored agent',
    description: 'A CIS-8004 agent.',
    subjectKind: 'agent',
    stratum: 'non_mcp_provenance',
    selectionRule: 'non_mcp_provenance/v1',
    selectionReason: 'Provenance outside the MCP registry. Tests something.',
    externalSource: 'concordium-cis8004',
    externalId: '7',
    endpoint: 'https://tippingservice.co.uk/agents/x/.well-known/agent-card.json',
    repository: null,
    protocols: ['a2a-card'],
    endpointCheck: null,
    ...overrides,
  }
}

test('the manual baseline never authors a chain an importer already owns', () => {
  const plan = planBaselineObservations(
    [
      member(),
      member({ agentId: OTHER, handle: 'io.github.a/server', externalSource: 'mcp-registry', subjectKind: 'mcp_server' }),
    ],
    T2,
  )
  assert.deepEqual(plan.profiles, [], 'both provenances collect their own fields')
  assert.deepEqual(plan.deferredProfiles, { 'concordium-cis8004': 1, 'mcp-registry': 1 })
})

test('the deferred subjects are the ones the cohort rule promises a collector for', () => {
  for (const provenance of PROVENANCES_WITH_FIELD_COLLECTOR) {
    const plan = planBaselineObservations([member({ externalSource: provenance })], T2)
    assert.deepEqual(plan.profiles, [], `${provenance} must be left to its importer`)
  }
  assert.equal(hasFieldCollector('moltbook'), false)
  assert.equal(hasFieldCollector(null), false, 'nothing collects our own native subjects')
})

test('the fabricated change the skip prevents', () => {
  // Why this is not a style preference. The stored catalogue row cannot hold the on-chain
  // anchors — nothing in `agents` has a column for them — so a manual baseline is a POORER
  // reading of the same subject, not a stale one. Written first, the importer's very first
  // append would diff against it and publish an anchoring event that never happened.
  const fromStoredRow = profileFacts({
    displayName: 'Anchored agent',
    description: 'A CIS-8004 agent.',
    endpoint: 'https://tippingservice.co.uk/agents/x/.well-known/agent-card.json',
    protocols: ['a2a-card'],
  })
  const fromImporter = profileFacts({
    displayName: 'Anchored agent',
    description: 'A CIS-8004 agent.',
    endpoint: 'https://tippingservice.co.uk/agents/x/.well-known/agent-card.json',
    protocols: ['a2a-card'],
    anchors: { token_address: '3xyz', metadata_hash: 'ab12' },
  })
  const invented = diffFacts(fromStoredRow, fromImporter)
  assert.ok(
    invented.some((change) => change.path.startsWith('anchors') && change.kind === 'added'),
    'this is the immutable lie the baseline used to set up',
  )
  assert.deepEqual(planBaselineObservations([member()], T2).profiles, [], 'so it is never written')
})

test('a provenance with no collector keeps its manual baseline', () => {
  const plan = planBaselineObservations(
    [
      member({ handle: 'moltbook-1', externalSource: 'moltbook' }),
      member({ agentId: OTHER, handle: 'native-1', externalSource: null, externalId: null }),
    ],
    T2,
  )
  assert.deepEqual(
    plan.profiles.map((entry) => entry.source),
    ['moltbook', 'native'],
    'for them the alternative is no history at all',
  )
  assert.deepEqual(plan.deferredProfiles, {})
  assert.equal(plan.profiles[0].collector, BASELINE_COLLECTOR)
})

test('availability is still baselined, including for the deferred subjects', () => {
  // Not the same situation: both readings come from the same probe through the same
  // reducer, so the baseline is that collector's own last measurement, not a rival view.
  const plan = planBaselineObservations([member({ endpointCheck: PROBED })], T2)
  assert.deepEqual(plan.profiles, [])
  assert.equal(plan.availability.length, 1)
  assert.equal(plan.availability[0].source, 'endpoint-probe')
})

test('a subject never probed gets no invented availability row', () => {
  const plan = planBaselineObservations([member({ externalSource: 'moltbook' })], T2)
  assert.deepEqual(plan.availability, [])
  assert.equal(plan.profiles.length, 1)
})

test('an unknown provenance still refuses attribution at baseline time', () => {
  assert.throws(() => planBaselineObservations([member({ externalSource: 'some-new-registry' })], T2), /unknown provenance/)
})
