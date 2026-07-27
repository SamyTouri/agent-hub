// L'évaluateur est l'endroit où une chronologie devient une décision, donc l'endroit où
// une erreur coûte le plus cher : elle sortirait sous forme de verdict sur le service de
// quelqu'un d'autre. Trois promesses sont testées littéralement — l'absence de preuve
// n'est jamais une faute, l'évaluateur n'a aucune marge d'appréciation, et deux sources
// qui se contredisent ne sont jamais fondues en une vérité moyenne.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EVALUATOR_VERSION,
  POLICY_CRITERION_KINDS,
  POLICY_EVALUATION_SCHEMA,
  POLICY_VOCABULARY_VERSION,
  SOURCES_WITH_CHECK_TELEMETRY,
  currentStateFreshness,
  evaluatePolicy,
  parsePolicyDocument,
  validatePolicy,
  type ActivationPolicy,
  type EvidenceDossier,
  type PolicyCriterion,
} from '../lib/evidence-policy.ts'
import {
  DEMO_CUTOFF,
  EXAMPLE_POLICIES,
  PRAGMATIC_ACTIVATION_POLICY,
  STRICT_ACTIVATION_POLICY,
  SYNTHETIC,
  syntheticScenarios,
} from '../lib/evidence-policy-examples.ts'
import { EVIDENCE_SCHEMA_VERSION, availabilityFacts, contentHash, profileFacts } from '../lib/evidence-history.ts'
import type { StoredObservation, TimelineSubject } from '../lib/evidence-timeline.ts'

const CUTOFF = DEMO_CUTOFF
const policyById = new Map(EXAMPLE_POLICIES.map((policy) => [policy.id, policy]))

const SUBJECT: TimelineSubject = {
  handle: 'io.github.test/subject',
  displayName: 'Test subject',
  subjectKind: 'mcp_server',
  provenance: 'mcp-registry',
  cohort: null,
}

let seq = 0
function observation(source: string, facts: Record<string, unknown>, observedAt: string, overrides: Partial<StoredObservation> = {}): StoredObservation {
  seq += 1
  return {
    id: `obs-${seq}`,
    seq,
    subjectKind: 'mcp_server',
    subjectKey: SUBJECT.handle,
    source: source as StoredObservation['source'],
    sourceUrl: null,
    observedAt,
    effectiveAt: null,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    contentHash: contentHash({ source, facts }),
    facts: facts as StoredObservation['facts'],
    previousObservationId: null,
    changeSummary: [],
    visibility: 'public_summary',
    collector: 'test',
    ...overrides,
  }
}

function policy(criteria: PolicyCriterion[]): ActivationPolicy {
  return { id: 'test.policy', version: '1.0.0', vocabularyVersion: POLICY_VOCABULARY_VERSION, criteria }
}

function dossier(observations: StoredObservation[], lastCheckedAt?: Record<string, string>): EvidenceDossier {
  return { subject: SUBJECT, observations, ...(lastCheckedAt ? { lastCheckedAt } : {}) }
}

// ---------------------------------------------------------------------------
// The four decisions, from the synthetic scenarios
// ---------------------------------------------------------------------------

test('the synthetic examples are marked synthetic and invent no real supplier', () => {
  assert.equal(SYNTHETIC, true)
  for (const scenario of syntheticScenarios()) {
    assert.equal(scenario.synthetic, true)
    assert.match(scenario.dossier.subject.handle, /synthetic/)
    for (const entry of scenario.dossier.observations) assert.equal(entry.collector, 'synthetic')
  }
})

test('every scenario produces the decision it was written to produce', () => {
  for (const scenario of syntheticScenarios()) {
    const chosen = policyById.get(scenario.policyId)
    assert.ok(chosen, `unknown policy ${scenario.policyId}`)
    const evaluation = evaluatePolicy({ dossier: scenario.dossier, policy: chosen, cutoff: CUTOFF })
    assert.equal(evaluation.decision, scenario.expected, `${scenario.name}: ${evaluation.decision_basis}`)
  }
})

test('all four decisions are actually exercised', () => {
  const decisions = new Set(
    syntheticScenarios().map(
      (scenario) => evaluatePolicy({ dossier: scenario.dossier, policy: policyById.get(scenario.policyId)!, cutoff: CUTOFF }).decision,
    ),
  )
  assert.deepEqual(
    [...decisions].sort(),
    ['conditional_activation', 'criteria_not_satisfied', 'criteria_satisfied', 'insufficient_evidence'],
  )
})

// ---------------------------------------------------------------------------
// Precedence
// ---------------------------------------------------------------------------

test('a proven failure is never softened by an unknown', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ status: 'deprecated' }), '2026-07-01T00:00:00.000Z')]),
    policy: policy([
      { id: 'status', kind: 'field_in', source: 'mcp-registry', field: 'status', allowed: ['active'], requirement: 'required' },
      { id: 'probe', kind: 'source_present', source: 'endpoint-probe', requirement: 'required' },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'criteria_not_satisfied')
  assert.equal(evaluation.criteria[0].result, 'failed')
  assert.equal(evaluation.criteria[1].result, 'unknown')
  assert.match(evaluation.decision_basis, /status/)
})

test('an unknown required criterion outranks a pending condition', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ status: 'active' }), '2026-07-01T00:00:00.000Z')]),
    policy: policy([
      { id: 'probe', kind: 'source_present', source: 'endpoint-probe', requirement: 'required' },
      { id: 'fresh', kind: 'checked_since', source: 'mcp-registry', days: 1, requirement: 'conditional', safeguard: 'Re-check by hand.' },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'insufficient_evidence')
})

test('conditional activation only ever comes from a condition the policy declared', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ status: 'active' }), '2026-07-01T00:00:00.000Z')]),
    policy: policy([
      { id: 'present', kind: 'source_present', source: 'mcp-registry', requirement: 'required' },
      {
        id: 'anchored',
        kind: 'field_present',
        source: 'mcp-registry',
        field: 'anchors.metadata_hash',
        requirement: 'conditional',
        safeguard: 'Ask the supplier for an anchor before granting write scopes.',
      },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'conditional_activation')
  const conditional = evaluation.criteria.find((criterion) => criterion.id === 'anchored')
  assert.equal(conditional?.result, 'conditional')
  assert.equal(conditional?.safeguard, 'Ask the supplier for an anchor before granting write scopes.')
})

test('an informational criterion never changes the decision', () => {
  const observations = [
    observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-07-01T00:00:00.000Z'),
    observation('concordium-cis8004', profileFacts({ endpoint: 'https://b.test/' }), '2026-07-01T00:00:00.000Z'),
  ]
  const evaluation = evaluatePolicy({
    dossier: dossier(observations),
    policy: policy([
      { id: 'present', kind: 'source_present', source: 'mcp-registry', requirement: 'required' },
      {
        id: 'agree',
        kind: 'no_contradiction',
        sources: ['mcp-registry', 'concordium-cis8004'],
        field: 'endpoint',
        requirement: 'informational',
      },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'criteria_satisfied')
  assert.equal(evaluation.criteria.find((criterion) => criterion.id === 'agree')?.result, 'failed')
})

// ---------------------------------------------------------------------------
// Absence of evidence
// ---------------------------------------------------------------------------

test('a source we never observed is unknown, not a failure', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([]),
    policy: policy([{ id: 'probe', kind: 'source_present', source: 'endpoint-probe', requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'insufficient_evidence')
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /no_evidence_from_source/)
  assert.equal(evaluation.criteria[0].references.length, 0)
})

test('a field never observed cannot be checked against an allowed set', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-07-01T00:00:00.000Z')]),
    policy: policy([{ id: 'status', kind: 'field_in', source: 'mcp-registry', field: 'status', allowed: ['active'], requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
})

test('stability is unknown when our own history is younger than the question', () => {
  // The trap: answering "nothing changed" after two days of tracking would be true and
  // useless, and a buyer would read it as ninety days of calm.
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-07-25T00:00:00.000Z')]),
    policy: policy([{ id: 'stable', kind: 'no_change_since', source: 'mcp-registry', field: 'endpoint', days: 90, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /history_shorter_than_window/)
})

test('freshness is never read off the ledger, because the ledger only records changes', () => {
  const observations = [observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-01-01T00:00:00.000Z')]
  const withoutCheck = evaluatePolicy({
    dossier: dossier(observations),
    policy: policy([{ id: 'fresh', kind: 'checked_since', source: 'mcp-registry', days: 7, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(withoutCheck.criteria[0].result, 'unknown', 'a stable subject must not be reported as stale')
  assert.match(withoutCheck.criteria[0].explanation, /only records changes/)

  const withCheck = evaluatePolicy({
    dossier: dossier(observations, { 'mcp-registry': '2026-07-26T00:00:00.000Z' }),
    policy: policy([{ id: 'fresh', kind: 'checked_since', source: 'mcp-registry', days: 7, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(withCheck.criteria[0].result, 'passed')
})

// ---------------------------------------------------------------------------
// Contradictions stay contradictions
// ---------------------------------------------------------------------------

test('two disagreeing sources are both named and neither is arbitrated', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([
      observation('mcp-registry', profileFacts({ endpoint: 'https://registry.test/mcp' }), '2026-07-01T00:00:00.000Z'),
      observation('concordium-cis8004', profileFacts({ endpoint: 'https://chain.test/card' }), '2026-07-02T00:00:00.000Z'),
    ]),
    policy: policy([
      {
        id: 'agree',
        kind: 'no_contradiction',
        sources: ['mcp-registry', 'concordium-cis8004'],
        field: 'endpoint',
        requirement: 'required',
      },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'criteria_not_satisfied')
  const [criterion] = evaluation.criteria
  assert.match(criterion.explanation, /registry\.test/)
  assert.match(criterion.explanation, /chain\.test/)
  assert.match(criterion.explanation, /do not arbitrate/)
  assert.deepEqual(
    criterion.references.map((entry) => entry.source),
    ['mcp-registry', 'concordium-cis8004'],
  )
})

test('a contradiction cannot be checked when only one side reports the field', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([
      observation('mcp-registry', profileFacts({ endpoint: 'https://registry.test/mcp' }), '2026-07-01T00:00:00.000Z'),
      observation('concordium-cis8004', profileFacts({ displayName: 'Anchored' }), '2026-07-02T00:00:00.000Z'),
    ]),
    policy: policy([
      {
        id: 'agree',
        kind: 'no_contradiction',
        sources: ['mcp-registry', 'concordium-cis8004'],
        field: 'endpoint',
        requirement: 'required',
      },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
})

// ---------------------------------------------------------------------------
// Cutoff, determinism, shape
// ---------------------------------------------------------------------------

test('evidence after the cutoff is invisible to the evaluation', () => {
  const observations = [
    observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-07-01T00:00:00.000Z'),
    observation('endpoint-probe', availabilityFacts({ checked_at: '2026-08-01T00:00:00.000Z', responded: true, status: 200, consecutive_failures: 0 }), '2026-08-01T00:00:00.000Z'),
  ]
  const evaluation = evaluatePolicy({
    dossier: dossier(observations),
    policy: policy([{ id: 'probe', kind: 'source_present', source: 'endpoint-probe', requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown', 'an observation dated after the cutoff must not be used')
  assert.equal(evaluation.evidence_cutoff, CUTOFF)
})

test('the same dossier and policy always produce byte-identical output', () => {
  const scenario = syntheticScenarios()[0]
  const chosen = policyById.get(scenario.policyId)!
  const once = JSON.stringify(evaluatePolicy({ dossier: scenario.dossier, policy: chosen, cutoff: CUTOFF }))
  const twice = JSON.stringify(evaluatePolicy({ dossier: { ...scenario.dossier, observations: [...scenario.dossier.observations].reverse() }, policy: chosen, cutoff: CUTOFF }))
  assert.equal(once, twice, 'observation order in the input must not leak into the output')
})

test('criteria are reported in the order the policy declared them', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-07-01T00:00:00.000Z')]),
    policy: policy([
      { id: 'c', kind: 'source_present', source: 'mcp-registry', requirement: 'informational' },
      { id: 'a', kind: 'source_present', source: 'mcp-registry', requirement: 'informational' },
      { id: 'b', kind: 'source_present', source: 'mcp-registry', requirement: 'informational' },
    ]),
    cutoff: CUTOFF,
  })
  assert.deepEqual(
    evaluation.criteria.map((criterion) => criterion.id),
    ['c', 'a', 'b'],
  )
})

test('the output is a decision aid and says so, with no score anywhere', () => {
  const scenario = syntheticScenarios()[0]
  const evaluation = evaluatePolicy({ dossier: scenario.dossier, policy: policyById.get(scenario.policyId)!, cutoff: CUTOFF })
  assert.equal(evaluation.schema, POLICY_EVALUATION_SCHEMA)
  assert.equal(evaluation.evaluator_version, EVALUATOR_VERSION)
  assert.match(evaluation.disclaimer, /[Nn]ot a certification/)
  // The scan covers the decision-bearing parts only: the limitations and the disclaimer
  // legitimately name what this output is NOT.
  const decisionBearing = JSON.stringify({
    decision: evaluation.decision,
    decision_basis: evaluation.decision_basis,
    criteria: evaluation.criteria,
  }).toLowerCase()
  for (const forbidden of ['score', 'rating', 'rank', 'certif', 'trust_level', 'grade', 'weight']) {
    assert.ok(!decisionBearing.includes(forbidden), `"${forbidden}" must not appear in a decision`)
  }
  for (const criterion of evaluation.criteria) {
    assert.ok(criterion.explanation.length > 20, `${criterion.id} must explain itself`)
  }
})

test('every criterion cites the observations it actually used', () => {
  const scenario = syntheticScenarios()[0]
  const evaluation = evaluatePolicy({ dossier: scenario.dossier, policy: policyById.get(scenario.policyId)!, cutoff: CUTOFF })
  const known = new Set(scenario.dossier.observations.map((entry) => entry.id))
  for (const criterion of evaluation.criteria) {
    for (const cited of criterion.references) {
      assert.ok(known.has(cited.observation_id), `${criterion.id} cites an observation that is not in the dossier`)
    }
  }
})

// ---------------------------------------------------------------------------
// The policy vocabulary is closed and auditable
// ---------------------------------------------------------------------------

test('the shipped example policies are valid', () => {
  for (const example of EXAMPLE_POLICIES) assert.deepEqual(validatePolicy(example), [])
  assert.notEqual(STRICT_ACTIVATION_POLICY.id, PRAGMATIC_ACTIVATION_POLICY.id)
})

test('the vocabulary stays small enough to be read aloud', () => {
  assert.equal(POLICY_CRITERION_KINDS.length, 6)
  assert.equal(new Set(POLICY_CRITERION_KINDS).size, 6)
})

test('a policy written against another vocabulary is refused, not reinterpreted', () => {
  const problems = validatePolicy({
    ...policy([{ id: 'x', kind: 'source_present', source: 'mcp-registry', requirement: 'required' }]),
    vocabularyVersion: 99,
  })
  assert.deepEqual(problems.map((problem) => problem.code), ['unsupported_vocabulary'])
})

test('a condition without a remedy is a policy error, not evaluator improvisation', () => {
  const problems = validatePolicy(policy([{ id: 'x', kind: 'field_present', source: 'mcp-registry', field: 'repository', requirement: 'conditional' }]))
  assert.deepEqual(problems.map((problem) => problem.code), ['conditional_without_safeguard'])
})

test('malformed policies are caught before anything is evaluated', () => {
  const cases: Array<[PolicyCriterion[], string]> = [
    [[{ id: 'x', kind: 'no_change_since', source: 'mcp-registry', days: 0, requirement: 'required' }], 'non_positive_window'],
    [[{ id: 'x', kind: 'field_in', source: 'mcp-registry', field: 'status', allowed: [], requirement: 'required' }], 'empty_allowed_set'],
    [
      [{ id: 'x', kind: 'no_contradiction', sources: ['mcp-registry', 'mcp-registry'], field: 'endpoint', requirement: 'required' }],
      'contradiction_needs_two_sources',
    ],
    [
      [
        { id: 'dup', kind: 'source_present', source: 'mcp-registry', requirement: 'required' },
        { id: 'dup', kind: 'source_present', source: 'mcp-registry', requirement: 'required' },
      ],
      'duplicate_criterion',
    ],
    [
      [{ id: 'x', kind: 'source_present', source: 'mcp-registry', requirement: 'required', safeguard: 'pointless' }],
      'safeguard_without_condition',
    ],
  ]
  for (const [criteria, expected] of cases) {
    assert.ok(validatePolicy(policy(criteria)).some((problem) => problem.code === expected), expected)
  }
  assert.ok(validatePolicy(policy([])).some((problem) => problem.code === 'empty_policy'))
})

test('an invalid policy is refused loudly rather than evaluated partially', () => {
  assert.throws(
    () => evaluatePolicy({ dossier: dossier([]), policy: { ...policy([]), vocabularyVersion: 42 }, cutoff: CUTOFF }),
    /invalid policy/,
  )
})

test('an unusable cutoff is refused', () => {
  assert.throws(
    () =>
      evaluatePolicy({
        dossier: dossier([]),
        policy: policy([{ id: 'x', kind: 'source_present', source: 'mcp-registry', requirement: 'required' }]),
        cutoff: 'yesterday',
      }),
    /invalid evidence cutoff/,
  )
})

// ---------------------------------------------------------------------------
// Freshness may never be borrowed from an unrelated write
// ---------------------------------------------------------------------------

test('an unrelated row update can never make a registry freshness criterion pass', () => {
  // agents.updated_at is refreshed by a generic trigger on ANY write to the row — the
  // endpoint probe storing its own result, a claim, a maintenance script. Feeding it to a
  // registry `checked_since` would certify a re-read of the registry that never happened.
  const freshness = currentStateFreshness({
    updatedAt: '2026-07-26T23:59:00.000Z',
    endpointCheckedAt: '2026-07-26T23:59:00.000Z',
  })
  assert.deepEqual(Object.keys(freshness), ['endpoint-probe'])
  assert.equal(freshness['mcp-registry'], undefined)

  const evaluation = evaluatePolicy({
    dossier: {
      subject: SUBJECT,
      observations: [observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-01-01T00:00:00.000Z')],
      lastCheckedAt: freshness,
    },
    policy: policy([{ id: 'registry-fresh', kind: 'checked_since', source: 'mcp-registry', days: 7, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /last_check_not_supplied/)
  assert.equal(evaluation.decision, 'insufficient_evidence')
})

test('only sources with real check telemetry can answer a freshness question today', () => {
  assert.deepEqual([...SOURCES_WITH_CHECK_TELEMETRY], ['endpoint-probe'])
})

test('an unusable last-check date is unknown, never stale', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('endpoint-probe', { state: 'responding' }, '2026-07-01T00:00:00.000Z')], {
      'endpoint-probe': 'not a date',
    }),
    policy: policy([{ id: 'fresh', kind: 'checked_since', source: 'endpoint-probe', days: 7, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /last_check_unparseable/)
})

test('a check dated after the cutoff cannot make a criterion pass', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('endpoint-probe', { state: 'responding' }, '2026-07-01T00:00:00.000Z')], {
      'endpoint-probe': '2026-08-15T00:00:00.000Z',
    }),
    policy: policy([{ id: 'fresh', kind: 'checked_since', source: 'endpoint-probe', days: 7, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /last_check_after_cutoff/)
})

// ---------------------------------------------------------------------------
// Unusable observation dates fail closed
// ---------------------------------------------------------------------------

test('an observation with an unusable date is excluded, not treated as current', () => {
  // `NaN > cutoff` is false, so a malformed date used to sail straight past the cutoff
  // test and count as evidence in force.
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('endpoint-probe', { state: 'responding' }, 'whenever')]),
    policy: policy([
      { id: 'reachable', kind: 'field_in', source: 'endpoint-probe', field: 'state', allowed: ['responding'], requirement: 'required' },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.equal(evaluation.decision, 'insufficient_evidence')
  assert.ok(evaluation.unknowns.includes('dossier: unusable_observation_dates=1'))
  assert.ok(evaluation.limitations.some((entry) => /unusable date/.test(entry)))
})

// ---------------------------------------------------------------------------
// Typed values
// ---------------------------------------------------------------------------

test('the string "true" is not the boolean true', () => {
  const asString = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', { verified: 'true' }, '2026-07-01T00:00:00.000Z')]),
    policy: policy([{ id: 'v', kind: 'field_in', source: 'mcp-registry', field: 'verified', allowed: [true], requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(asString.criteria[0].result, 'failed', 'a string must not satisfy a boolean allowed value')

  const asBoolean = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', { verified: true }, '2026-07-01T00:00:00.000Z')]),
    policy: policy([{ id: 'v', kind: 'field_in', source: 'mcp-registry', field: 'verified', allowed: [true], requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(asBoolean.criteria[0].result, 'passed')
})

test('a structured value cannot be membership-tested', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', { protocols: ['mcp'] }, '2026-07-01T00:00:00.000Z')]),
    policy: policy([{ id: 'p', kind: 'field_in', source: 'mcp-registry', field: 'protocols', allowed: ['mcp'], requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /field_not_scalar/)
})

test('two sources reporting the same text in different JSON types disagree', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([
      observation('mcp-registry', { verified: true }, '2026-07-01T00:00:00.000Z'),
      observation('concordium-cis8004', { verified: 'true' }, '2026-07-02T00:00:00.000Z'),
    ]),
    policy: policy([
      { id: 'agree', kind: 'no_contradiction', sources: ['mcp-registry', 'concordium-cis8004'], field: 'verified', requirement: 'required' },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'failed')
})

// ---------------------------------------------------------------------------
// Stability: truncation and path relationships
// ---------------------------------------------------------------------------

function chained(
  source: string,
  facts: Record<string, unknown>,
  observedAt: string,
  changeSummary: Array<{ path: string; kind: 'added' | 'removed' | 'changed' }>,
) {
  const first = observation(source, {}, '2026-01-01T00:00:00.000Z')
  const second = observation(source, facts, observedAt, { previousObservationId: first.id, changeSummary })
  return [first, second]
}

test('a truncated change summary makes a field-specific stability claim unknown', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier(
      chained('mcp-registry', { endpoint: 'https://a.test/' }, '2026-07-20T00:00:00.000Z', [
        { path: 'display_name', kind: 'changed' },
        { path: '$truncated', kind: 'changed' },
      ]),
    ),
    policy: policy([{ id: 'stable', kind: 'no_change_since', source: 'mcp-registry', field: 'endpoint', days: 90, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'unknown')
  assert.match(String(evaluation.criteria[0].unknown_reason), /change_summary_truncated/)
})

test('a change on a parent path counts as touching the child, and the reverse', () => {
  const child = evaluatePolicy({
    dossier: dossier(chained('mcp-registry', { anchors: { hash: 'b' } }, '2026-07-20T00:00:00.000Z', [{ path: 'anchors', kind: 'changed' }])),
    policy: policy([
      { id: 'stable', kind: 'no_change_since', source: 'mcp-registry', field: 'anchors.hash', days: 90, requirement: 'required' },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(child.criteria[0].result, 'failed', 'the whole object moved, so the field inside it moved')

  const parent = evaluatePolicy({
    dossier: dossier(
      chained('mcp-registry', { anchors: { hash: 'b' } }, '2026-07-20T00:00:00.000Z', [{ path: 'anchors.hash', kind: 'changed' }]),
    ),
    policy: policy([{ id: 'stable', kind: 'no_change_since', source: 'mcp-registry', field: 'anchors', days: 90, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(parent.criteria[0].result, 'failed', 'a field inside the object moved, so the object moved')
})

test('an unrelated change does not fail a field-specific stability claim', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier(
      chained('mcp-registry', { endpoint: 'https://a.test/' }, '2026-07-20T00:00:00.000Z', [{ path: 'display_name', kind: 'changed' }]),
    ),
    policy: policy([{ id: 'stable', kind: 'no_change_since', source: 'mcp-registry', field: 'endpoint', days: 90, requirement: 'required' }]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.criteria[0].result, 'passed')
})

// ---------------------------------------------------------------------------
// A conditional criterion over unknown evidence is deliberate, not accidental
// ---------------------------------------------------------------------------

test('a conditional criterion over unknown evidence still names the gap', () => {
  const evaluation = evaluatePolicy({
    dossier: dossier([observation('mcp-registry', profileFacts({ endpoint: 'https://a.test/' }), '2026-07-01T00:00:00.000Z')]),
    policy: policy([
      { id: 'present', kind: 'source_present', source: 'mcp-registry', requirement: 'required' },
      {
        id: 'probe',
        kind: 'source_present',
        source: 'endpoint-probe',
        requirement: 'conditional',
        safeguard: 'Probe the endpoint yourself before granting scopes.',
      },
    ]),
    cutoff: CUTOFF,
  })
  assert.equal(evaluation.decision, 'conditional_activation')
  const conditional = evaluation.criteria[1]
  assert.equal(conditional.result, 'conditional')
  // The reader must be able to tell "the evidence said no" from "the evidence said nothing".
  assert.match(String(conditional.unknown_reason), /no_evidence_from_source/)
  assert.ok(evaluation.unknowns.some((entry) => entry.startsWith('probe:')))
})

// ---------------------------------------------------------------------------
// Runtime parsing of an untrusted policy document
// ---------------------------------------------------------------------------

function document(overrides: Record<string, unknown> = {}) {
  return {
    id: 'buyer.policy',
    version: '1.0.0',
    vocabularyVersion: POLICY_VOCABULARY_VERSION,
    criteria: [{ id: 'present', kind: 'source_present', source: 'mcp-registry', requirement: 'required' }],
    ...overrides,
  }
}

test('a well-formed document parses into a usable policy', () => {
  const parsed = parsePolicyDocument(document())
  assert.equal(parsed.ok, true)
  assert.ok(parsed.ok && parsed.policy.criteria.length === 1)
})

test('a misspelled requirement is refused, never silently dropped', () => {
  // The dangerous shape: an unrecognised requirement falls out of the decidable set, so a
  // policy whose only real constraint was misspelled comes back as satisfied.
  const parsed = parsePolicyDocument(
    document({ criteria: [{ id: 'present', kind: 'source_present', source: 'mcp-registry', requirement: 'Required' }] }),
  )
  assert.equal(parsed.ok, false)
  assert.ok(!parsed.ok && parsed.problems.some((problem) => problem.code === 'invalid_requirement'))
})

test('anything that is not a policy object fails closed', () => {
  for (const bad of [null, undefined, 42, 'policy', true, [], [{ id: 'x' }]]) {
    const parsed = parsePolicyDocument(bad)
    assert.equal(parsed.ok, false, `${JSON.stringify(bad) ?? String(bad)} must be refused`)
  }
})

test('every malformed field is reported rather than thrown', () => {
  const cases: Array<[unknown, string]> = [
    [document({ id: '   ' }), 'invalid_id'],
    [document({ version: '' }), 'invalid_version'],
    [document({ vocabularyVersion: '1' }), 'invalid_vocabulary_version'],
    [document({ criteria: 'all of them' }), 'criteria_not_an_array'],
    [document({ criteria: [] }), 'empty_policy'],
    [document({ criteria: [null] }), 'criterion_not_an_object'],
    [document({ criteria: [{ kind: 'source_present', source: 'a', requirement: 'required' }] }), 'invalid_criterion_id'],
    [document({ criteria: [{ id: 'x', kind: 'source_exists', source: 'a', requirement: 'required' }] }), 'unknown_kind'],
    [document({ criteria: [{ id: 'x', kind: 'source_present', requirement: 'required' }] }), 'invalid_source'],
    [document({ criteria: [{ id: 'x', kind: 'field_present', source: 'a', requirement: 'required' }] }), 'invalid_field'],
    [
      document({ criteria: [{ id: 'x', kind: 'checked_since', source: 'a', days: Number.POSITIVE_INFINITY, requirement: 'required' }] }),
      'non_positive_window',
    ],
    [document({ criteria: [{ id: 'x', kind: 'checked_since', source: 'a', days: Number.NaN, requirement: 'required' }] }), 'non_positive_window'],
    [document({ criteria: [{ id: 'x', kind: 'checked_since', source: 'a', days: -1, requirement: 'required' }] }), 'non_positive_window'],
    [document({ criteria: [{ id: 'x', kind: 'checked_since', source: 'a', days: '7', requirement: 'required' }] }), 'non_positive_window'],
    [
      document({ criteria: [{ id: 'x', kind: 'field_in', source: 'a', field: 'f', allowed: [{ nested: true }], requirement: 'required' }] }),
      'invalid_allowed_value',
    ],
    [document({ criteria: [{ id: 'x', kind: 'field_in', source: 'a', field: 'f', allowed: [], requirement: 'required' }] }), 'empty_allowed_set'],
    [
      document({ criteria: [{ id: 'x', kind: 'field_in', source: 'a', field: 'f', allowed: 'active', requirement: 'required' }] }),
      'empty_allowed_set',
    ],
    [
      document({ criteria: [{ id: 'x', kind: 'no_contradiction', sources: ['a'], field: 'f', requirement: 'required' }] }),
      'contradiction_needs_two_sources',
    ],
    [
      document({ criteria: [{ id: 'x', kind: 'no_contradiction', sources: ['a', 'a'], field: 'f', requirement: 'required' }] }),
      'contradiction_needs_two_sources',
    ],
    [
      document({
        criteria: [
          { id: 'dup', kind: 'source_present', source: 'a', requirement: 'required' },
          { id: 'dup', kind: 'source_present', source: 'a', requirement: 'required' },
        ],
      }),
      'duplicate_criterion',
    ],
    [
      document({ criteria: [{ id: 'x', kind: 'field_present', source: 'a', field: 'f', requirement: 'conditional' }] }),
      'conditional_without_safeguard',
    ],
  ]
  for (const [candidate, expected] of cases) {
    const parsed = parsePolicyDocument(candidate)
    assert.equal(parsed.ok, false, `${expected} must be refused`)
    assert.ok(
      !parsed.ok && parsed.problems.some((problem) => problem.code === expected),
      `expected ${expected}, got ${!parsed.ok ? parsed.problems.map((problem) => problem.code).join(',') : 'ok'}`,
    )
  }
})

test('the shipped example policies survive a JSON round-trip through the parser', () => {
  for (const example of EXAMPLE_POLICIES) {
    const parsed = parsePolicyDocument(JSON.parse(JSON.stringify(example)))
    assert.equal(parsed.ok, true, example.id)
    assert.ok(parsed.ok && parsed.policy.criteria.length === example.criteria.length)
  }
})
