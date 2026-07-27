// Un rapport de contrôle qui se trompe est pire qu'aucun rapport : il donne la
// tranquillité sans la preuve. Ces tests portent donc sur les endroits où il serait
// tentant d'affirmer plus que ce que la base montre — l'attribution d'une écriture à un
// import, la fraîcheur d'un contrôle, et le nombre de doublons prétendument supprimés.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AVAILABILITY_BASELINE_COLLECTOR,
  AVAILABILITY_TRANSITION_COLLECTOR,
  CYCLE_CHECK_SCHEMA,
  IMPORT_COLLECTORS,
  buildCycleReport,
  isExpectedAvailabilityHandoff,
  resolveWindow,
  type Check,
  type CycleFacts,
  type CycleWindow,
} from '../lib/evidence-cycle-report.ts'
import { BASELINE_COLLECTOR } from '../lib/evidence-store.ts'

const NOW = '2026-07-28T06:00:00.000Z'

function window(): CycleWindow {
  const resolved = resolveWindow({ since: '2026-07-28T00:00:00.000Z', until: '2026-07-28T06:00:00.000Z', now: NOW })
  assert.ok(resolved.ok)
  return resolved.window
}

function facts(overrides: Partial<CycleFacts> = {}): CycleFacts {
  return {
    window: window(),
    cohortId: 'pilot-2026-07',
    ledger: { rows: 40, subjects: 40, firstObservedAt: '2026-07-27T12:00:00.000Z', lastObservedAt: '2026-07-28T01:00:00.000Z' },
    bySourceCollector: [{ source: 'mcp-registry', collector: 'script:evidence-cohort', rows: 40, lastObservedAt: '2026-07-27T12:00:00.000Z' }],
    windowBySourceCollector: [],
    windowTotals: { rows: 0, baselines: 0, transitions: 0 },
    probe: { freshChecks: 250, newestCheck: '2026-07-28T01:05:00.000Z', malformedCheckDates: 0 },
    rowsTouchedWithoutFreshCheck: 0,
    cohort: [{ handle: 'io.github.a/one', stratum: 'multi_source_identity', probeable: true, checkedAt: '2026-07-28T01:05:00.000Z' }],
    integrity: {
      danglingParents: 0,
      forks: 0,
      duplicateBaselines: 0,
      crossChainParents: 0,
      identicalConsecutive: 0,
      backdated: 0,
    },
    multiCollectorChains: [],
    multiCollectorTruncated: false,
    unknownSources: [],
    storage: { observations_total_bytes: 65536 },
    ...overrides,
  }
}

const checkById = (report: Record<string, unknown>, id: string) =>
  (report.checks as Check[]).find((check) => check.id === id)!

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

test('a reversed window is refused instead of quietly returning nothing', () => {
  const reversed = resolveWindow({ since: '2026-07-28T06:00:00Z', until: '2026-07-28T00:00:00Z', now: NOW })
  assert.equal(reversed.ok, false)
  assert.ok(!reversed.ok && /strictly before/.test(reversed.error))
})

test('an empty window is refused too', () => {
  const equal = resolveWindow({ since: NOW, until: NOW, now: NOW })
  assert.equal(equal.ok, false)
})

test('an unusable bound is refused, not defaulted', () => {
  assert.equal(resolveWindow({ since: 'last night', now: NOW }).ok, false)
  assert.equal(resolveWindow({ until: 'soon', now: NOW }).ok, false)
  assert.equal(resolveWindow({ now: 'whenever' }).ok, false)
})

test('bounds are normalized once into canonical instants', () => {
  const resolved = resolveWindow({ since: '2026-07-28T02:00:00+02:00', until: '2026-07-28T06:00:00Z', now: NOW })
  assert.ok(resolved.ok)
  assert.equal(resolved.window.since, '2026-07-28T00:00:00.000Z')
  assert.equal(resolved.window.until, '2026-07-28T06:00:00.000Z')
  assert.equal(resolved.window.untilMs - resolved.window.sinceMs, 6 * 3600 * 1000)
})

test('the default window is the last twenty-four hours', () => {
  const resolved = resolveWindow({ now: NOW })
  assert.ok(resolved.ok)
  assert.equal(resolved.window.until, NOW)
  assert.equal(resolved.window.since, '2026-07-27T06:00:00.000Z')
})

// ---------------------------------------------------------------------------
// Import attribution — the heuristic must never be able to say "passed"
// ---------------------------------------------------------------------------

test('a touched catalogue row can never prove an import ran', () => {
  // Registration, claim and maintenance scripts write agents.updated_at too. Treating it
  // as import evidence would report a successful cycle on the strength of someone
  // claiming their profile.
  const report = buildCycleReport(facts({ rowsTouchedWithoutFreshCheck: 4321 }), NOW)
  const check = checkById(report, 'registry-and-concordium-ran')
  assert.equal(check.verdict, 'inconclusive')
  assert.match(String(check.evidence.catalogue_rows_touched_note), /never proof/)
  assert.match(String(check.cannot_prove), /Vercel/)
})

test('only a ledger row signed by an import collector proves the import ran', () => {
  const report = buildCycleReport(
    facts({ windowBySourceCollector: [{ source: 'mcp-registry', collector: 'cron:registry', rows: 3 }] }),
    NOW,
  )
  const check = checkById(report, 'registry-and-concordium-ran')
  assert.equal(check.verdict, 'passed')
  assert.match(check.finding, /cron:registry/)
})

test('the Concordium collector counts as import evidence too', () => {
  const report = buildCycleReport(
    facts({ windowBySourceCollector: [{ source: 'concordium-cis8004', collector: 'cron:registry/concordium', rows: 1 }] }),
    NOW,
  )
  assert.equal(checkById(report, 'registry-and-concordium-ran').verdict, 'passed')
  assert.deepEqual([...IMPORT_COLLECTORS], ['cron:registry', 'cron:registry/concordium'])
})

test('a probe write is not import evidence', () => {
  const report = buildCycleReport(
    facts({ windowBySourceCollector: [{ source: 'endpoint-probe', collector: 'cron:daily', rows: 12 }] }),
    NOW,
  )
  assert.equal(checkById(report, 'registry-and-concordium-ran').verdict, 'inconclusive')
})

// ---------------------------------------------------------------------------
// Probe execution
// ---------------------------------------------------------------------------

test('a fresh check proves a probe ran, but not which one', () => {
  const check = checkById(buildCycleReport(facts(), NOW), 'endpoint-probe-ran')
  assert.equal(check.verdict, 'passed')
  // The offline catch-up script writes the same field, so attribution needs Vercel.
  assert.match(String(check.cannot_prove), /catch-up script/)
})

test('no fresh check at all is a finding, not a shrug', () => {
  const check = checkById(buildCycleReport(facts({ probe: { freshChecks: 0, newestCheck: null, malformedCheckDates: 0 } }), NOW), 'endpoint-probe-ran')
  assert.equal(check.verdict, 'failed')
  assert.match(String(check.cannot_prove), /never invoked, or was invoked and failed/)
})

// ---------------------------------------------------------------------------
// Cohort freshness
// ---------------------------------------------------------------------------

test('an unreadable check date never counts as a fresh look', () => {
  const report = buildCycleReport(
    facts({ cohort: [{ handle: 'io.github.a/one', stratum: 'availability_watch', probeable: true, checkedAt: 'yesterday' }] }),
    NOW,
  )
  const check = checkById(report, 'cohort-examined')
  assert.equal(check.verdict, 'failed')
  assert.deepEqual(check.evidence.not_freshly_checked, ['io.github.a/one'])
})

test('a check dated outside the window is not fresh', () => {
  const report = buildCycleReport(
    facts({ cohort: [{ handle: 'io.github.a/one', stratum: 'availability_watch', probeable: true, checkedAt: '2026-07-20T00:00:00.000Z' }] }),
    NOW,
  )
  assert.equal(checkById(report, 'cohort-examined').verdict, 'failed')
})

test('a partially examined cohort is inconclusive, not a pass', () => {
  const report = buildCycleReport(
    facts({
      cohort: [
        { handle: 'io.github.a/one', stratum: 'x', probeable: true, checkedAt: '2026-07-28T01:00:00.000Z' },
        { handle: 'io.github.a/two', stratum: 'x', probeable: true, checkedAt: null },
      ],
    }),
    NOW,
  )
  const check = checkById(report, 'cohort-examined')
  assert.equal(check.verdict, 'inconclusive')
  assert.deepEqual(check.evidence.not_freshly_checked, ['io.github.a/two'])
})

// ---------------------------------------------------------------------------
// Deduplication: no invented counter
// ---------------------------------------------------------------------------

test('the report never states how many identical states were suppressed', () => {
  // The window can span several cycles, and a check that produced no row leaves nothing
  // to count. A confident number here would be exactly the kind of comfortable fiction
  // this project exists to refuse.
  const report = buildCycleReport(facts(), NOW)
  const check = checkById(report, 'deduplication-and-transitions')
  assert.equal(check.verdict, 'passed')
  assert.match(String(check.evidence.suppressed_identical_states), /not counted/)
  assert.equal(check.evidence.deduplicated_estimate, undefined)
  assert.ok(!/\d+ identical state/.test(check.finding))
  assert.match(String(check.cannot_prove), /Zero new observations is a normal successful cycle/)
})

test('a consecutive duplicate in the ledger fails the deduplication check', () => {
  const report = buildCycleReport(facts({ integrity: { ...facts().integrity, identicalConsecutive: 2 } }), NOW)
  assert.equal(checkById(report, 'deduplication-and-transitions').verdict, 'failed')
})

// ---------------------------------------------------------------------------
// Attribution anomalies use the real chain key
// ---------------------------------------------------------------------------

test('a multi-author chain is reported by subject id and source, not by handle', () => {
  // The handle is the label of the day: it changes, and it is not unique across time.
  // Grouping on it would both miss real anomalies and invent fake ones.
  const report = buildCycleReport(
    facts({
      multiCollectorChains: [
        { subjectAgentId: '11111111-1111-4111-8111-111111111111', source: 'mcp-registry', collectors: 'cron:registry,script:evidence-cohort' },
      ],
    }),
    NOW,
  )
  const check = checkById(report, 'ledger-integrity')
  assert.equal(check.verdict, 'failed')
  const [example] = check.evidence.multi_collector_anomaly_examples as Array<Record<string, unknown>>
  assert.equal(example.subject_agent_id, '11111111-1111-4111-8111-111111111111')
  assert.equal(example.source, 'mcp-registry')
  assert.equal(example.subject_key, undefined)
})

// ---------------------------------------------------------------------------
// The designed availability handoff is not corruption
// ---------------------------------------------------------------------------

const HANDOFF = {
  subjectAgentId: '33333333-3333-4333-8333-333333333333',
  source: 'endpoint-probe',
  collectors: `${AVAILABILITY_TRANSITION_COLLECTOR},${AVAILABILITY_BASELINE_COLLECTOR}`,
}

test('the baseline-to-cron handoff on an availability chain is not an integrity failure', () => {
  // Without this the first genuine availability transition — the very event the whole
  // pilot is waiting for — would have been reported as a corrupt ledger.
  const report = buildCycleReport(facts({ multiCollectorChains: [HANDOFF] }), NOW)
  const check = checkById(report, 'ledger-integrity')
  assert.equal(check.verdict, 'passed')
  assert.equal(check.evidence.multi_collector_anomalies, 0)
})

test('the exception is named in the output, not applied in silence', () => {
  const check = checkById(buildCycleReport(facts({ multiCollectorChains: [HANDOFF] }), NOW), 'ledger-integrity')
  assert.equal(check.evidence.expected_availability_handoffs, 1)
  assert.deepEqual(check.evidence.expected_availability_handoff_examples, [
    { subject_agent_id: HANDOFF.subjectAgentId, source: 'endpoint-probe', collectors: HANDOFF.collectors },
  ])
  assert.match(String(check.evidence.expected_handoff_rule), /only the exact pair/)
  assert.match(check.finding, /designed baseline-to-cron handoff/)
})

test('collector order in the SQL aggregate does not decide the verdict', () => {
  for (const collectors of [
    `${AVAILABILITY_BASELINE_COLLECTOR},${AVAILABILITY_TRANSITION_COLLECTOR}`,
    `${AVAILABILITY_TRANSITION_COLLECTOR},${AVAILABILITY_BASELINE_COLLECTOR}`,
    ` ${AVAILABILITY_TRANSITION_COLLECTOR} , ${AVAILABILITY_BASELINE_COLLECTOR} `,
  ]) {
    assert.equal(isExpectedAvailabilityHandoff({ source: 'endpoint-probe', collectors }), true, collectors)
  }
})

test('a third collector on an availability chain is still an anomaly', () => {
  const rogue = {
    subjectAgentId: HANDOFF.subjectAgentId,
    source: 'endpoint-probe',
    collectors: `${AVAILABILITY_BASELINE_COLLECTOR},${AVAILABILITY_TRANSITION_COLLECTOR},cron:registry`,
  }
  assert.equal(isExpectedAvailabilityHandoff(rogue), false)
  const check = checkById(buildCycleReport(facts({ multiCollectorChains: [rogue] }), NOW), 'ledger-integrity')
  assert.equal(check.verdict, 'failed')
  assert.equal(check.evidence.multi_collector_anomalies, 1)
})

test('the exception never leaks onto a profile chain', () => {
  for (const source of ['mcp-registry', 'concordium-cis8004', 'moltbook', 'native']) {
    const row = { subjectAgentId: HANDOFF.subjectAgentId, source, collectors: HANDOFF.collectors }
    assert.equal(isExpectedAvailabilityHandoff(row), false, source)
    assert.equal(checkById(buildCycleReport(facts({ multiCollectorChains: [row] }), NOW), 'ledger-integrity').verdict, 'failed')
  }
})

test('an availability chain written by two unrelated collectors is still an anomaly', () => {
  const row = { subjectAgentId: HANDOFF.subjectAgentId, source: 'endpoint-probe', collectors: 'cron:daily,cron:registry' }
  assert.equal(isExpectedAvailabilityHandoff(row), false)
  assert.equal(checkById(buildCycleReport(facts({ multiCollectorChains: [row] }), NOW), 'ledger-integrity').verdict, 'failed')
})

test('a real anomaly alongside legitimate handoffs still fails the check', () => {
  const report = buildCycleReport(
    facts({
      multiCollectorChains: [
        HANDOFF,
        { subjectAgentId: '44444444-4444-4444-8444-444444444444', source: 'mcp-registry', collectors: 'cron:registry,script:evidence-cohort' },
      ],
    }),
    NOW,
  )
  const check = checkById(report, 'ledger-integrity')
  assert.equal(check.verdict, 'failed')
  assert.equal(check.evidence.multi_collector_anomalies, 1)
  assert.equal(check.evidence.expected_availability_handoffs, 1)
})

test('the exception cannot drift away from the collector that actually writes the baseline', () => {
  // If the baseline collector is renamed, this fails rather than silently reverting to a
  // false alarm on every availability chain.
  assert.equal(AVAILABILITY_BASELINE_COLLECTOR, BASELINE_COLLECTOR)
})

test('a truncated multi-collector sample cannot be read as "no anomaly"', () => {
  const report = buildCycleReport(facts({ multiCollectorChains: [HANDOFF], multiCollectorTruncated: true }), NOW)
  const check = checkById(report, 'ledger-integrity')
  assert.equal(check.verdict, 'inconclusive')
  assert.match(String(check.cannot_prove), /truncated sample/)
  assert.equal(report.overall, 'inconclusive')
})

test('a truncated sample does not soften a defect that was already found', () => {
  const report = buildCycleReport(
    facts({ multiCollectorTruncated: true, integrity: { ...facts().integrity, forks: 1 } }),
    NOW,
  )
  assert.equal(checkById(report, 'ledger-integrity').verdict, 'failed')
})

test('an unknown source is an attribution anomaly', () => {
  const report = buildCycleReport(facts({ unknownSources: [{ source: 'mystery', rows: 3 }] }), NOW)
  assert.equal(checkById(report, 'ledger-integrity').verdict, 'failed')
})

// ---------------------------------------------------------------------------
// Overall shape
// ---------------------------------------------------------------------------

test('a failure anywhere outranks an inconclusive', () => {
  const report = buildCycleReport(facts({ probe: { freshChecks: 0, newestCheck: null, malformedCheckDates: 0 } }), NOW)
  assert.equal(report.overall, 'failed')
  assert.match(String(report.overall_basis), /endpoint-probe-ran/)
})

test('an inconclusive check keeps the whole run inconclusive', () => {
  const report = buildCycleReport(facts(), NOW)
  assert.equal(report.overall, 'inconclusive', 'no import collector wrote, so the import cannot be settled')
})

test('the report always says the database cannot prove an invocation', () => {
  const report = buildCycleReport(facts(), NOW)
  assert.equal(report.schema, CYCLE_CHECK_SCHEMA)
  assert.equal(report.read_only, true)
  const notes = report.vercel_check_required as string[]
  assert.ok(notes.some((note) => /cannot prove that a Vercel function was invoked/.test(note)))
  assert.ok(notes.some((note) => /indistinguishable/.test(note)))
})

test('the same facts always produce the same report', () => {
  assert.equal(JSON.stringify(buildCycleReport(facts(), NOW)), JSON.stringify(buildCycleReport(facts(), NOW)))
})
