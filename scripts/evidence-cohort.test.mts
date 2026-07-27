// La cohorte est ce qu'un acheteur contestera en premier : « pourquoi ces sujets-là ? ».
// La réponse doit être une règle qu'on peut rejouer, pas une intuition. Ces tests
// vérifient donc trois choses — la sélection est reproductible, elle ne récompense pas la
// popularité, et la justification écrite en base ne revendique jamais l'aval d'un tiers.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUSINESS_FAMILY_CAP,
  BUSINESS_SYSTEM_FAMILIES,
  COHORT_MAX_SUBJECTS,
  COHORT_MIN_SUBJECTS,
  NON_MCP_PROVENANCE_CAP,
  PROXY_DISCLAIMER,
  STRATUM_CAPS,
  businessFamilyOf,
  familyRegex,
  selectCohort,
  validateCohort,
  type CandidateSubject,
  type CohortPick,
} from '../lib/evidence-cohort.ts'
import { nextCheck } from '../lib/endpoint-probe.ts'

let counter = 0
function candidate(overrides: Partial<CandidateSubject> = {}): CandidateSubject {
  counter += 1
  const handle = overrides.handle ?? `io.github.owner/subject-${String(counter).padStart(3, '0')}`
  return {
    agentId: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    handle,
    displayName: null,
    description: 'A server.',
    externalSource: 'mcp-registry',
    externalId: handle,
    endpoint: 'https://example.test/mcp',
    repository: null,
    hasRepositoryObservation: false,
    endpointCheck: null,
    ...overrides,
  }
}

const DOWN = nextCheck(null, { responded: false }, '2026-07-26T10:00:00.000Z')
const UP = nextCheck(null, { responded: true, status: 200 }, '2026-07-26T10:00:00.000Z')

/** A catalogue shaped like the real one: every subject sits in the `io.github.*`
 *  namespace, which is exactly what used to break naive keyword matching. */
function catalogue(): CandidateSubject[] {
  const rows: CandidateSubject[] = []
  for (const { family } of BUSINESS_SYSTEM_FAMILIES) {
    rows.push(candidate({ handle: `io.github.vendor/${family}-mcp-server`, endpointCheck: UP }))
  }
  for (let i = 0; i < 20; i++) {
    rows.push(
      candidate({
        handle: `io.github.multi/depth-${String(i).padStart(2, '0')}`,
        repository: `https://github.com/multi/depth-${i}`,
        hasRepositoryObservation: true,
        endpointCheck: UP,
      }),
    )
  }
  for (let i = 0; i < 15; i++) {
    rows.push(candidate({ handle: `io.github.silent/quiet-${String(i).padStart(2, '0')}`, endpointCheck: DOWN }))
  }
  for (let i = 0; i < 17; i++) {
    rows.push(candidate({ handle: `concordium-${String(i).padStart(2, '0')}`, externalSource: 'concordium' }))
  }
  for (let i = 0; i < 2; i++) {
    rows.push(candidate({ handle: `moltbook-${i}`, externalSource: 'moltbook' }))
  }
  for (let i = 0; i < 5; i++) {
    rows.push(candidate({ handle: `native-${i}`, externalSource: null, externalId: null }))
  }
  return rows
}

// ---------------------------------------------------------------------------
// Family matching — the trap the real catalogue sets
// ---------------------------------------------------------------------------

test('the registry namespace does not turn every server into a GitHub connector', () => {
  // 13 972 subjects carry a `io.github.*` handle. Matching the whole handle would have
  // classified a weather server as a GitHub integration.
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.someone/weather-mcp' })), null)
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.github/github-mcp-server' })), 'github')
})

test('a family keyword matches whole words, never fragments of another product', () => {
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.a/dropbox-mcp' })), 'dropbox')
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.a/sandbox-runner' })), null)
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.a/box-files' })), 'box')
})

test('a multi-word keyword matches only consecutive words', () => {
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.a/google-drive-tools' })), 'google-drive')
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.a/google-search' })), null)
})

test('a passing mention in a description is not a connector', () => {
  const mentioner = candidate({
    handle: 'io.github.a/weather',
    description: 'Weather data. Source on GitHub, discuss on Slack, notes in Notion.',
  })
  assert.equal(businessFamilyOf(mentioner), null)
})

test('the display name is enough when the handle is opaque', () => {
  assert.equal(businessFamilyOf(candidate({ handle: 'io.github.a/wk-1', displayName: 'Slack Connector' })), 'slack')
})

test('the SQL pre-filter mirrors the rule instead of merely approximating it', () => {
  for (const { keywords } of BUSINESS_SYSTEM_FAMILIES) {
    const pattern = new RegExp(familyRegex(keywords))
    for (const keyword of keywords) {
      assert.ok(pattern.test(`${keyword.replace(/ /g, '-')}-mcp-server`), `${keyword} must survive the pre-filter`)
    }
  }
  assert.ok(!new RegExp(familyRegex(['box'])).test('sandbox-runner'))
  assert.ok(!new RegExp(familyRegex(['box'])).test('dropbox-mcp'))
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

test('the same catalogue always produces the same cohort, whatever order it arrives in', () => {
  const rows = catalogue()
  const shuffled = [...rows].reverse()
  const interleaved = [...rows.filter((_, i) => i % 2 === 1), ...rows.filter((_, i) => i % 2 === 0)]
  const reference = selectCohort(rows)
  assert.deepEqual(selectCohort(shuffled), reference)
  assert.deepEqual(selectCohort(interleaved), reference)
  assert.deepEqual(selectCohort([...rows, ...rows]), reference, 'a duplicated row is not a second subject')
})

test('a realistic catalogue yields a cohort inside the ratified bounds', () => {
  const picks = selectCohort(catalogue())
  assert.deepEqual(validateCohort(picks), [])
  assert.ok(picks.length >= COHORT_MIN_SUBJECTS && picks.length <= COHORT_MAX_SUBJECTS, `${picks.length} subjects`)
})

test('every stratum is represented and none exceeds its ceiling', () => {
  const picks = selectCohort(catalogue())
  const counts = new Map<string, number>()
  for (const pick of picks) counts.set(pick.stratum, (counts.get(pick.stratum) ?? 0) + 1)
  for (const [stratum, cap] of Object.entries(STRATUM_CAPS)) {
    assert.ok((counts.get(stratum) ?? 0) > 0, `${stratum} is empty`)
    assert.ok((counts.get(stratum) ?? 0) <= cap, `${stratum} exceeds ${cap}`)
  }
})

test('one connector per workplace family, never ten copies of the same one', () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) => candidate({ handle: `io.github.a/slack-${i}` })),
    ...catalogue(),
  ]
  const families = selectCohort(rows)
    .filter((pick) => pick.stratum === 'business_system_connector')
    .map((pick) => pick.selectionFamily)
  assert.equal(new Set(families).size, families.length)
  assert.equal(families.filter((family) => family === 'slack').length, BUSINESS_FAMILY_CAP)
})

test('the non-MCP stratum never collapses onto a single registry', () => {
  const picks = selectCohort(catalogue()).filter((pick) => pick.stratum === 'non_mcp_provenance')
  const perProvenance = new Map<string, number>()
  for (const pick of picks) {
    perProvenance.set(pick.selectionFamily!, (perProvenance.get(pick.selectionFamily!) ?? 0) + 1)
  }
  assert.ok(perProvenance.size >= 2, 'at least two provenances outside the MCP registry')
  for (const count of perProvenance.values()) assert.ok(count <= NON_MCP_PROVENANCE_CAP)
})

test('a subject lands in exactly one stratum, by declared precedence', () => {
  // This one qualifies for three rules at once: it is a Notion connector, it has three
  // surfaces, and its endpoint is silent. Precedence has to be recorded, not accidental.
  const overlapping = candidate({
    handle: 'io.github.a/notion-mcp',
    repository: 'https://github.com/a/notion-mcp',
    hasRepositoryObservation: true,
    endpointCheck: DOWN,
  })
  const picks = selectCohort([overlapping, ...catalogue()])
  const mine = picks.filter((pick) => pick.handle === overlapping.handle)
  assert.equal(mine.length, 1)
  assert.equal(mine[0].stratum, 'business_system_connector')
})

test('popularity is never the tie-break: the alphabetically first candidate wins', () => {
  const popular = candidate({
    handle: 'io.github.a/zzz-slack-mcp',
    hasRepositoryObservation: true,
    repository: 'https://github.com/a/zzz',
  })
  const obscure = candidate({ handle: 'io.github.a/aaa-slack-mcp' })
  const picks = selectCohort([popular, obscure, ...catalogue()])
  const slack = picks.find((pick) => pick.selectionFamily === 'slack')
  assert.equal(slack?.handle, 'io.github.a/aaa-slack-mcp')
})

test('a subject we cannot go and look at is not worth tracking', () => {
  const unobservable = candidate({ handle: 'io.github.a/slack-paper', endpoint: null, repository: null })
  const observable = candidate({ handle: 'io.github.b/slack-live' })
  const picks = selectCohort([unobservable, observable])
  assert.deepEqual(
    picks.map((pick) => pick.handle),
    ['io.github.b/slack-live'],
  )
})

test('a private or loopback endpoint is never treated as an observable surface', () => {
  const localOnly = candidate({ handle: 'io.github.a/slack-local', endpoint: 'http://localhost:3000/mcp' })
  assert.deepEqual(selectCohort([localOnly]), [])
})

// ---------------------------------------------------------------------------
// What the cohort row says about itself
// ---------------------------------------------------------------------------

test('every subject carries a versioned rule and a reason worth reading', () => {
  for (const pick of selectCohort(catalogue())) {
    assert.match(pick.selectionRule, /^[a-z_]+\/v\d+$/)
    assert.ok(pick.selectionReason.length >= 20)
    assert.match(pick.selectionReason, /Tests /, 'a reason states what the subject is meant to prove')
  }
})

test('the workplace proxy never claims a vendor endorsed it', () => {
  const business = selectCohort(catalogue()).filter((pick) => pick.stratum === 'business_system_connector')
  assert.ok(business.length > 0)
  for (const pick of business) {
    assert.ok(pick.selectionReason.includes(PROXY_DISCLAIMER))
    assert.match(pick.selectionReason, /not endorsed by any vendor/i)
  }
  const everything = JSON.stringify(selectCohort(catalogue()))
  assert.ok(!/aident/i.test(everything), 'no partner name is asserted anywhere in the stored justification')
})

test('the repository signal is described as provenance, never as quality', () => {
  const [depth] = selectCohort(catalogue()).filter((pick) => pick.stratum === 'multi_source_identity')
  assert.match(depth.selectionReason, /never as a quality score/i)
})

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

function pick(overrides: Partial<CohortPick> = {}): CohortPick {
  counter += 1
  return {
    agentId: `10000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    handle: `subject-${counter}`,
    subjectKind: 'mcp_server',
    stratum: 'multi_source_identity',
    selectionRule: 'multi_source_identity/v1',
    selectionFamily: null,
    selectionReason: 'A reason long enough to pass the check. Tests something.',
    ...overrides,
  }
}

function codes(problems: ReturnType<typeof validateCohort>) {
  return [...new Set(problems.map((problem) => problem.code))].sort()
}

test('a cohort too small to prove anything is reported as such', () => {
  const problems = codes(validateCohort([pick({ stratum: 'non_mcp_provenance', selectionRule: 'non_mcp_provenance/v1' })]))
  assert.ok(problems.includes('size_below_minimum'))
})

test('a cohort that grew past the pilot bound is reported too', () => {
  const many = Array.from({ length: COHORT_MAX_SUBJECTS + 1 }, () => pick())
  assert.ok(codes(validateCohort(many)).includes('size_above_maximum'))
})

test('a cohort resting on one registry is refused', () => {
  const single = Array.from({ length: COHORT_MIN_SUBJECTS }, () => pick())
  assert.ok(codes(validateCohort(single)).includes('missing_non_mcp_provenance'))
})

test('duplicates, unversioned rules and empty reasons are all caught', () => {
  const twin = pick()
  const problems = codes(
    validateCohort([
      twin,
      twin,
      pick({ selectionRule: 'legacy' }),
      pick({ selectionReason: 'too short' }),
      pick({ stratum: 'non_mcp_provenance', selectionRule: 'non_mcp_provenance/v1', selectionFamily: 'concordium' }),
    ]),
  )
  assert.ok(problems.includes('duplicate_subject'))
  assert.ok(problems.includes('unversioned_selection_rule'))
  assert.ok(problems.includes('empty_selection_reason'))
})

test('overfilling a stratum, a family or a provenance is caught', () => {
  const overFamily = Array.from({ length: BUSINESS_FAMILY_CAP + 1 }, () =>
    pick({
      stratum: 'business_system_connector',
      selectionRule: 'business_system_connector/v1',
      selectionFamily: 'slack',
    }),
  )
  assert.ok(codes(validateCohort(overFamily)).includes('family_over_cap'))

  const overProvenance = Array.from({ length: NON_MCP_PROVENANCE_CAP + 1 }, () =>
    pick({ stratum: 'non_mcp_provenance', selectionRule: 'non_mcp_provenance/v1', selectionFamily: 'concordium' }),
  )
  assert.ok(codes(validateCohort(overProvenance)).includes('provenance_over_cap'))

  const overStratum = Array.from({ length: STRATUM_CAPS.availability_watch + 1 }, () =>
    pick({ stratum: 'availability_watch', selectionRule: 'availability_watch/v1' }),
  )
  assert.ok(codes(validateCohort(overStratum)).includes('stratum_over_cap'))
})
