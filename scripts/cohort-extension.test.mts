// Trois choses que l'extension de cohorte ne doit pas rater, et qui n'ont rien de
// théorique : un plafond qui tronque en silence, une sélection qui change entre la
// relecture et l'écriture, et une règle de campagne qu'on requalifie après avoir vu le
// résultat. Les tests portent sur ces trois-là.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COHORT_ID,
  COHORT_SPEC_V1,
  COHORT_SPEC_V2,
  CURRENT_COHORT_SPEC,
  PROBE_WAVE_WIDTH,
} from '../lib/evidence-cohort.ts'
import { MAX_COHORT_SUBJECTS_LOADED, MAX_OBSERVATIONS_PER_RUN } from '../lib/evidence-store.ts'
import {
  COHORT_MANIFEST_SCHEMA,
  buildCohortManifest,
  verifyCohortManifest,
} from '../lib/evidence-manifest.ts'
import {
  BATCH_1_COMPLETED_AT,
  MOLTBOOK_GATE_VERSION,
  NOT_BUYER_DEMAND,
  PUBLIC_PRICE,
  assessWave,
  classifyReply,
  moltbookGateStatus,
  moltbookGates,
} from '../lib/moltbook-gate.ts'
import type { CohortPick } from '../lib/evidence-cohort.ts'

// ---------------------------------------------------------------------------
// A cohort of 112 must not be silently truncated anywhere
// ---------------------------------------------------------------------------

test('the write and load ceilings both sit above the cohort we intend to track', () => {
  // À 100, un socle de disponibilité de 112 sujets aurait été coupé à 100 sans un mot,
  // et douze sujets suivis n'auraient jamais eu de chaîne. Ne rien écrire étant un
  // résultat normal ici, aucune alerte ne l'aurait signalé.
  assert.ok(MAX_OBSERVATIONS_PER_RUN > CURRENT_COHORT_SPEC.maxSubjects)
  assert.ok(MAX_COHORT_SUBJECTS_LOADED > CURRENT_COHORT_SPEC.maxSubjects)
})

test('the cohort ceiling stays inside one probe wave', () => {
  assert.ok(CURRENT_COHORT_SPEC.maxSubjects < PROBE_WAVE_WIDTH)
})

test('the extension grew the cohort without loosening its own bounds', () => {
  assert.ok(COHORT_SPEC_V2.targetSubjects > COHORT_SPEC_V1.targetSubjects)
  assert.ok(COHORT_SPEC_V2.minSubjects > COHORT_SPEC_V1.maxSubjects, 'v2 starts above where v1 stopped')
  assert.equal(COHORT_SPEC_V2.nonMcpProvenanceCap, COHORT_SPEC_V1.nonMcpProvenanceCap)
})

// ---------------------------------------------------------------------------
// The manifest: what was reviewed is what gets written
// ---------------------------------------------------------------------------

let counter = 0
function pick(overrides: Partial<CohortPick> = {}): CohortPick {
  counter += 1
  return {
    agentId: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    handle: `io.github.owner/subject-${String(counter).padStart(3, '0')}`,
    subjectKind: 'mcp_server',
    stratum: 'multi_source_identity',
    selectionRule: 'multi_source_identity/v2',
    selectionFamily: null,
    selectionReason: 'Observable through three independent surfaces. Tests identity resolution across sources.',
    ...overrides,
  }
}

const manifestOf = (additions: CohortPick[], alreadyTracked = 40) =>
  buildCohortManifest({
    cohort: COHORT_ID,
    spec: COHORT_SPEC_V2,
    additions,
    alreadyTracked,
    generatedAt: '2026-07-28T09:00:00.000Z',
  })

test('a manifest records the resulting total, not just the additions', () => {
  const manifest = manifestOf([pick(), pick()])
  assert.equal(manifest.schema, COHORT_MANIFEST_SCHEMA)
  assert.equal(manifest.already_tracked, 40)
  assert.equal(manifest.additions, 2)
  assert.equal(manifest.resulting_total, 42)
  assert.equal(manifest.target_total, COHORT_SPEC_V2.targetSubjects)
})

test('the same selection always produces the same manifest, byte for byte', () => {
  const a = pick()
  const b = pick()
  assert.equal(manifestOf([a, b]).content_hash, manifestOf([b, a]).content_hash)
})

test('a manifest planned and then reviewed verifies', () => {
  const manifest = manifestOf([pick(), pick()])
  const verified = verifyCohortManifest(JSON.parse(JSON.stringify(manifest)), {
    cohort: COHORT_ID,
    spec: COHORT_SPEC_V2,
  })
  assert.equal(verified.ok, true)
})

test('a subject added after the review is refused', () => {
  // Le cas qui justifie tout le mécanisme : le fichier a été relu, puis complété.
  const manifest = manifestOf([pick()])
  const tampered = JSON.parse(JSON.stringify(manifest))
  tampered.entries.push({
    agent_id: '99999999-9999-4999-8999-999999999999',
    handle: 'io.github.sneaky/extra',
    subject_kind: 'mcp_server',
    stratum: 'multi_source_identity',
    selection_rule: 'multi_source_identity/v2',
    selection_family: null,
    selection_reason: 'Slipped in after the review, which is exactly the point.',
  })
  tampered.additions = 2
  const verified = verifyCohortManifest(tampered, { cohort: COHORT_ID, spec: COHORT_SPEC_V2 })
  assert.equal(verified.ok, false)
  assert.ok(!verified.ok && verified.problems.some((problem) => problem.code === 'content_hash_mismatch'))
})

test('a manifest from another cohort or another version is refused', () => {
  const manifest = JSON.parse(JSON.stringify(manifestOf([pick()])))
  const wrongCohort = verifyCohortManifest(manifest, { cohort: 'other-cohort', spec: COHORT_SPEC_V2 })
  assert.equal(wrongCohort.ok, false)
  const wrongSpec = verifyCohortManifest(manifest, { cohort: COHORT_ID, spec: COHORT_SPEC_V1 })
  assert.equal(wrongSpec.ok, false)
})

test('anything that is not a manifest fails closed', () => {
  for (const bad of [null, undefined, 42, 'manifest', [], { schema: COHORT_MANIFEST_SCHEMA }]) {
    const verified = verifyCohortManifest(bad, { cohort: COHORT_ID, spec: COHORT_SPEC_V2 })
    assert.equal(verified.ok, false, `${JSON.stringify(bad) ?? String(bad)} must be refused`)
  }
})

test('a duplicated subject inside a manifest is caught before it is written', () => {
  const twin = pick()
  const manifest = JSON.parse(JSON.stringify(manifestOf([twin, twin])))
  const verified = verifyCohortManifest(manifest, { cohort: COHORT_ID, spec: COHORT_SPEC_V2 })
  assert.equal(verified.ok, false)
  assert.ok(!verified.ok && verified.problems.some((problem) => problem.code === 'duplicate_entry'))
})

// ---------------------------------------------------------------------------
// The Moltbook gate: the bar is written before the replies are read
// ---------------------------------------------------------------------------

test('the two gates open exactly 48 and 72 hours after the batch', () => {
  const gates = moltbookGates()
  assert.deepEqual(
    gates.map((gate) => [gate.name, gate.hoursAfterBatch]),
    [
      ['new_wave_48h', 48],
      ['final_assessment_72h', 72],
    ],
  )
  assert.equal(gates[0].opensAt, '2026-07-28T16:47:42.798Z')
  assert.equal(gates[1].opensAt, '2026-07-29T16:47:42.798Z')
  assert.equal(BATCH_1_COMPLETED_AT, '2026-07-26T16:47:42.798Z')
})

test('the clock is read from a supplied instant, never from the wall', () => {
  const before = moltbookGateStatus('2026-07-28T10:00:00.000Z')
  assert.equal(before[0].open, false)
  assert.ok(before[0].opensInHours > 0)
  const after = moltbookGateStatus('2026-07-29T17:00:00.000Z')
  assert.equal(after[0].open, true)
  assert.equal(after[1].open, true)
})

test('a qualified reply needs all three signals, not two', () => {
  const full = { threadId: 't1', namesPurchaseInProgress: true, namesSpecificCandidate: true, namesConsequenceOfFailure: true }
  assert.equal(classifyReply(full).qualified, true)
  for (const key of ['namesPurchaseInProgress', 'namesSpecificCandidate', 'namesConsequenceOfFailure'] as const) {
    const partial = { ...full, [key]: false }
    const verdict = classifyReply(partial)
    assert.equal(verdict.qualified, false, `${key} missing must disqualify`)
    assert.equal(verdict.missing.length, 1)
  }
})

test('silence produces no demand and no price rejection', () => {
  const assessment = assessWave({
    gate: 'final_assessment_72h',
    assessedAt: '2026-07-29T17:00:00.000Z',
    replies: [],
    threadsReviewed: 3,
  })
  assert.equal(assessment.decision, 'no_qualified_demand')
  assert.equal(assessment.price_unchanged, PUBLIC_PRICE)
  assert.ok(assessment.not_buyer_demand.some((line) => /Silence is not a rejection of the price/.test(line)))
  assert.ok(assessment.limits.some((line) => /Three threads measure three threads/.test(line)))
  assert.match(assessment.next_action, /do not change the price on the strength of silence/)
})

test('seller interest and compliments are named as what they are not', () => {
  assert.deepEqual(NOT_BUYER_DEMAND.length, 5)
  const joined = NOT_BUYER_DEMAND.join(' ')
  for (const shape of ['seller', 'methodological', 'partnership', 'compliment', 'Silence']) {
    assert.ok(joined.includes(shape), `${shape} must be named explicitly`)
  }
})

test('one qualified reply changes the next action, and is named', () => {
  const assessment = assessWave({
    gate: 'new_wave_48h',
    assessedAt: '2026-07-28T17:00:00.000Z',
    threadsReviewed: 3,
    replies: [
      { threadId: 'thread-a', namesPurchaseInProgress: true, namesSpecificCandidate: true, namesConsequenceOfFailure: true },
      { threadId: 'thread-b', namesPurchaseInProgress: false, namesSpecificCandidate: true, namesConsequenceOfFailure: false },
    ],
  })
  assert.equal(assessment.decision, 'qualified_demand')
  assert.deepEqual(assessment.qualified, ['thread-a'])
  assert.equal(assessment.unqualified[0].threadId, 'thread-b')
  assert.match(assessment.next_action, /Answer the qualified thread first/)
})

test('with no qualified reply, a new wave is allowed only from purchase signals', () => {
  const assessment = assessWave({
    gate: 'new_wave_48h',
    assessedAt: '2026-07-28T17:00:00.000Z',
    threadsReviewed: 3,
    replies: [{ threadId: 'thread-b', namesPurchaseInProgress: false, namesSpecificCandidate: true, namesConsequenceOfFailure: false }],
  })
  assert.equal(assessment.decision, 'no_qualified_demand')
  assert.match(assessment.next_action, /ONLY from explicit in-progress purchase signals/)
  assert.match(assessment.next_action, /Do not reactivate the hourly routine/)
  assert.equal(assessment.version, MOLTBOOK_GATE_VERSION)
})

test('an unusable instant is refused rather than silently defaulted', () => {
  assert.throws(() => moltbookGateStatus('soon'), /unusable current time/)
  assert.throws(() => moltbookGates('whenever'), /unusable batch completion time/)
})
