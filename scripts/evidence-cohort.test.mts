// La cohorte est ce qu'un acheteur contestera en premier : « pourquoi ces sujets-là ? ».
// La réponse doit être une règle qu'on peut rejouer, pas une intuition. Ces tests
// vérifient donc trois choses — la sélection est reproductible, elle ne récompense pas la
// popularité, et la justification écrite en base ne revendique jamais l'aval d'un tiers.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUSINESS_FAMILY_CAP,
  BUSINESS_SYSTEM_FAMILIES,
  COHORT_SPEC_V1,
  COHORT_SPEC_V2,
  CURRENT_COHORT_SPEC,
  PROBE_WAVE_WIDTH,
  COHORT_MAX_SUBJECTS,
  COHORT_MIN_SUBJECTS,
  NON_MCP_PROVENANCE_CAP,
  PROVENANCES_WITH_FIELD_COLLECTOR,
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

function countBy(values: readonly (string | null)[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value === null) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

/** Catalogue large enough to fill the v2 caps, shaped like the real one. */
function wideCatalogue(): CandidateSubject[] {
  const rows: CandidateSubject[] = []
  for (const { family } of BUSINESS_SYSTEM_FAMILIES) {
    for (let i = 0; i < 5; i++) {
      rows.push(candidate({ handle: `io.github.vendor${i}/${family}-mcp-server`, endpointCheck: UP }))
    }
  }
  for (let i = 0; i < 60; i++) {
    rows.push(
      candidate({
        handle: `io.github.multi/depth-${String(i).padStart(3, '0')}`,
        repository: `https://github.com/multi/depth-${i}`,
        hasRepositoryObservation: true,
        endpointCheck: UP,
      }),
    )
  }
  for (let i = 0; i < 60; i++) {
    rows.push(candidate({ handle: `io.github.silent/quiet-${String(i).padStart(3, '0')}`, endpointCheck: DOWN }))
  }
  for (let i = 0; i < 17; i++) {
    rows.push(candidate({ handle: `concordium-${String(i).padStart(2, '0')}`, externalSource: 'concordium-cis8004' }))
  }
  for (let i = 0; i < 6; i++) rows.push(candidate({ handle: `moltbook-${i}`, externalSource: 'moltbook' }))
  for (let i = 0; i < 6; i++) {
    rows.push(candidate({ handle: `native-${i}`, externalSource: null, externalId: null }))
  }
  return rows
}

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
    rows.push(candidate({ handle: `concordium-${String(i).padStart(2, '0')}`, externalSource: 'concordium-cis8004' }))
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

test('a realistic catalogue yields a v1 cohort inside its ratified bounds', () => {
  const picks = selectCohort(catalogue(), { spec: COHORT_SPEC_V1 })
  assert.deepEqual(validateCohort(picks, { spec: COHORT_SPEC_V1 }), [])
  assert.ok(
    picks.length >= COHORT_SPEC_V1.minSubjects && picks.length <= COHORT_SPEC_V1.maxSubjects,
    `${picks.length} subjects`,
  )
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

test('a family never exceeds its cap, whatever the version', () => {
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => candidate({ handle: `io.github.a/slack-${i}` })),
    ...catalogue(),
  ]
  for (const spec of [COHORT_SPEC_V1, COHORT_SPEC_V2]) {
    const families = selectCohort(rows, { spec })
      .filter((pick) => pick.stratum === 'business_system_connector')
      .map((pick) => pick.selectionFamily)
    assert.equal(
      families.filter((family) => family === 'slack').length,
      spec.businessFamilyCap,
      `v${spec.version}: slack must fill exactly its cap when the catalogue can supply it`,
    )
    for (const count of countBy(families).values()) {
      assert.ok(count <= spec.businessFamilyCap, `v${spec.version}: a family went over its cap`)
    }
  }
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

test('a non-MCP subject with nothing to look at is not tracked either', () => {
  // The stratum used to accept any non-MCP row. A subject with neither endpoint nor
  // repository would have sat in the cohort forever, producing one baseline and no
  // history — and the whole point of the stratum is to prove history accrues off-registry.
  const paperOnly = candidate({ handle: 'concordium-paper', externalSource: 'concordium-cis8004', endpoint: null })
  const loopback = candidate({ handle: 'moltbook-local', externalSource: 'moltbook', endpoint: 'http://localhost:8080' })
  const observable = candidate({ handle: 'native-live', externalSource: null, externalId: null })
  const repoOnly = candidate({
    handle: 'moltbook-repo',
    externalSource: 'moltbook',
    endpoint: null,
    repository: 'https://github.com/a/b',
  })
  const picks = selectCohort([paperOnly, loopback, observable, repoOnly])
  assert.deepEqual(
    picks.map((entry) => entry.handle).sort(),
    ['moltbook-repo', 'native-live'],
    'a public endpoint or a source repository, nothing less',
  )
  for (const entry of picks) assert.equal(entry.stratum, 'non_mcp_provenance')
})

test('the stored reason does not promise a history nobody collects', () => {
  const picks = selectCohort([
    candidate({ handle: 'concordium-1', externalSource: 'concordium-cis8004' }),
    candidate({ handle: 'moltbook-1', externalSource: 'moltbook' }),
  ])
  const byHandle = new Map(picks.map((entry) => [entry.handle, entry.selectionReason]))
  assert.ok(PROVENANCES_WITH_FIELD_COLLECTOR.has('concordium-cis8004'))
  assert.match(String(byHandle.get('concordium-1')), /appends profile observations, so field changes accumulate/)
  assert.match(String(byHandle.get('moltbook-1')), /no automatic field history until a collector exists/)
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

// ---------------------------------------------------------------------------
// Versioned extension: the v1 forty are preserved, the additions are bounded
// ---------------------------------------------------------------------------

test('the extension reaches its target from a catalogue that can supply it', () => {
  const picks = selectCohort(wideCatalogue(), { spec: COHORT_SPEC_V2 })
  assert.equal(picks.length, COHORT_SPEC_V2.targetSubjects)
  assert.deepEqual(validateCohort(picks, { spec: COHORT_SPEC_V2 }), [])
})

test('the whole cohort fits inside one probe wave, even if every subject is probeable', () => {
  // C'est la justification opérationnelle du chiffre : au-delà de la largeur d'une vague,
  // une partie des sujets suivis peut rester non contrôlée un jour donné, en silence.
  assert.ok(COHORT_SPEC_V2.targetSubjects < PROBE_WAVE_WIDTH)
  assert.ok(COHORT_SPEC_V2.maxSubjects < PROBE_WAVE_WIDTH)
  assert.equal(CURRENT_COHORT_SPEC, COHORT_SPEC_V2)
})

test('the target is the sum of what the strata are allowed to hold', () => {
  const capsTotal = Object.values(COHORT_SPEC_V2.caps).reduce((total, cap) => total + cap, 0)
  assert.equal(capsTotal, COHORT_SPEC_V2.targetSubjects, 'the number is derived, not rounded')
  assert.ok(COHORT_SPEC_V2.targetSubjects >= COHORT_SPEC_V2.minSubjects)
  assert.ok(COHORT_SPEC_V2.targetSubjects <= COHORT_SPEC_V2.maxSubjects)
})

test('subjects already tracked are never re-selected and never re-explained', () => {
  const rows = wideCatalogue()
  const first = selectCohort(rows, { spec: COHORT_SPEC_V1 })
  const tracked = first.map((pick) => ({
    agentId: pick.agentId,
    stratum: pick.stratum,
    selectionFamily: pick.selectionFamily,
  }))
  const additions = selectCohort(rows, { spec: COHORT_SPEC_V2, alreadyTracked: tracked })

  const trackedIds = new Set(tracked.map((subject) => subject.agentId))
  for (const pick of additions) {
    assert.ok(!trackedIds.has(pick.agentId), `${pick.handle} was already tracked and must not be picked again`)
    assert.match(pick.selectionRule, /\/v2$/, 'an addition carries the version that selected it')
  }
  for (const pick of first) assert.match(pick.selectionRule, /\/v1$/, 'the original rule is left untouched')
})

test('extending never overshoots the target, whatever the previous version picked', () => {
  const rows = wideCatalogue()
  const tracked = selectCohort(rows, { spec: COHORT_SPEC_V1 }).map((pick) => ({
    agentId: pick.agentId,
    stratum: pick.stratum,
    selectionFamily: pick.selectionFamily,
  }))
  const additions = selectCohort(rows, { spec: COHORT_SPEC_V2, alreadyTracked: tracked })
  assert.equal(tracked.length + additions.length, COHORT_SPEC_V2.targetSubjects)
})

test('already-tracked subjects count against the stratum and family ceilings', () => {
  const rows = wideCatalogue()
  const tracked = selectCohort(rows, { spec: COHORT_SPEC_V1 }).map((pick) => ({
    agentId: pick.agentId,
    stratum: pick.stratum,
    selectionFamily: pick.selectionFamily,
  }))
  const additions = selectCohort(rows, { spec: COHORT_SPEC_V2, alreadyTracked: tracked })
  const whole = [...tracked, ...additions.map((pick) => ({ stratum: pick.stratum, selectionFamily: pick.selectionFamily }))]

  for (const stratum of Object.keys(COHORT_SPEC_V2.caps) as Array<keyof typeof COHORT_SPEC_V2.caps>) {
    const count = whole.filter((subject) => subject.stratum === stratum).length
    assert.ok(count <= COHORT_SPEC_V2.caps[stratum], `${stratum}: ${count} over cap`)
  }
  const families = countBy(
    whole.filter((s) => s.stratum === 'business_system_connector').map((s) => s.selectionFamily),
  )
  for (const [family, count] of families) {
    assert.ok(count <= COHORT_SPEC_V2.businessFamilyCap, `${family}: ${count} over cap`)
  }
})

test('the extension is deterministic, whatever order the catalogue arrives in', () => {
  const rows = wideCatalogue()
  const tracked = selectCohort(rows, { spec: COHORT_SPEC_V1 }).map((pick) => ({
    agentId: pick.agentId,
    stratum: pick.stratum,
    selectionFamily: pick.selectionFamily,
  }))
  const reference = selectCohort(rows, { spec: COHORT_SPEC_V2, alreadyTracked: tracked })
  assert.deepEqual(selectCohort([...rows].reverse(), { spec: COHORT_SPEC_V2, alreadyTracked: tracked }), reference)
  assert.deepEqual(
    selectCohort([...rows, ...rows], { spec: COHORT_SPEC_V2, alreadyTracked: tracked }),
    reference,
    'a duplicated row is not a second subject',
  )
})

test('a catalogue too thin to reach the target is reported, not padded', () => {
  const picks = selectCohort(catalogue(), { spec: COHORT_SPEC_V2 })
  assert.ok(picks.length < COHORT_SPEC_V2.minSubjects)
  const problems = validateCohort(picks, { spec: COHORT_SPEC_V2 })
  assert.ok(problems.some((problem) => problem.code === 'size_below_minimum'))
})

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
      pick({ stratum: 'non_mcp_provenance', selectionRule: 'non_mcp_provenance/v1', selectionFamily: 'concordium-cis8004' }),
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
    pick({ stratum: 'non_mcp_provenance', selectionRule: 'non_mcp_provenance/v1', selectionFamily: 'concordium-cis8004' }),
  )
  assert.ok(codes(validateCohort(overProvenance)).includes('provenance_over_cap'))

  const overStratum = Array.from({ length: STRATUM_CAPS.availability_watch + 1 }, () =>
    pick({ stratum: 'availability_watch', selectionRule: 'availability_watch/v1' }),
  )
  assert.ok(codes(validateCohort(overStratum)).includes('stratum_over_cap'))
})
