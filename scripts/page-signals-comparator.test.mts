import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareFrozenPageSignals,
  type PageSignals,
  type PageSignalsSnapshot,
} from '../lib/page-signals-comparator.ts'

const SOURCE_HASH = 'a'.repeat(64)

function signals(): PageSignals {
  return {
    metadata: {
      title: 'Independent evidence before purchase',
      description: 'A bounded evidence case.',
      canonicalUrl: 'https://example.test/',
    },
    headings: [
      { level: 1, text: 'Independent evidence' },
      { level: 2, text: 'Current cases' },
    ],
    links: [
      'https://example.test/',
      'https://example.test/pricing?ref=nav#top',
      'https://other.test/source',
    ],
    forms: [],
    counts: {
      headings: 2,
      links: 3,
      images: 0,
      forms: 0,
      visibleWords: 42,
    },
  }
}

function snapshot(overrides: Partial<PageSignalsSnapshot> = {}): PageSignalsSnapshot {
  return {
    capturedAt: '2026-07-26T12:00:00.000Z',
    sourceSha256: SOURCE_HASH,
    signals: signals(),
    ...overrides,
  }
}

function compare(providerReport: PageSignals, afterOverrides: Partial<PageSignalsSnapshot> = {}) {
  return compareFrozenPageSignals({
    beforePayment: snapshot(),
    afterDelivery: snapshot({
      capturedAt: '2026-07-26T12:01:00.000Z',
      ...afterOverrides,
    }),
    providerReport,
  })
}

test('matches only an exact report against an unchanged page window', () => {
  const result = compare(signals())
  assert.equal(result.status, 'match')
  assert.deepEqual(result.mismatches, [])
})

test('rejects an omitted link', () => {
  const report = signals()
  report.links.splice(1, 1)
  report.counts.links = 2

  const result = compare(report)
  assert.equal(result.status, 'mismatch')
  assert.ok(result.mismatches.some((mismatch) => mismatch.path === 'links' && mismatch.kind === 'length'))
  assert.ok(result.mismatches.some((mismatch) => mismatch.path === 'counts.links'))
})

test('rejects links that contain the same members in another order', () => {
  const report = signals()
  ;[report.links[0], report.links[1]] = [report.links[1], report.links[0]]

  const result = compare(report)
  assert.equal(result.status, 'mismatch')
  assert.ok(result.mismatches.some((mismatch) => mismatch.path === 'links' && mismatch.kind === 'order'))
})

test('rejects a normalized-away query or fragment', () => {
  const report = signals()
  report.links[1] = 'https://example.test/pricing'

  const result = compare(report)
  assert.equal(result.status, 'mismatch')
  assert.ok(result.mismatches.some((mismatch) => mismatch.path === 'links[1]'))
})

test('rejects stale metadata even when the structure still looks valid', () => {
  const report = signals()
  report.metadata.title = 'Previous title'

  const result = compare(report)
  assert.equal(result.status, 'mismatch')
  assert.ok(result.mismatches.some((mismatch) => mismatch.path === 'metadata.title'))
})

test('refuses to claim a comparison when the page changed during the purchase window', () => {
  const result = compare(signals(), { sourceSha256: 'b'.repeat(64) })
  assert.equal(result.status, 'not_comparable')
  assert.equal(result.reason, 'source_changed_during_purchase_window')
})

test('refuses malformed or chronologically inverted snapshot evidence', () => {
  const malformed = compareFrozenPageSignals({
    beforePayment: snapshot({ sourceSha256: 'not-a-hash' }),
    afterDelivery: snapshot({ capturedAt: '2026-07-26T12:01:00.000Z' }),
    providerReport: signals(),
  })
  assert.equal(malformed.status, 'not_comparable')
  assert.equal(malformed.reason, 'invalid_snapshot_evidence')

  const inverted = compareFrozenPageSignals({
    beforePayment: snapshot({ capturedAt: '2026-07-26T12:02:00.000Z' }),
    afterDelivery: snapshot({ capturedAt: '2026-07-26T12:01:00.000Z' }),
    providerReport: signals(),
  })
  assert.equal(inverted.status, 'not_comparable')
  assert.equal(inverted.reason, 'snapshot_order_invalid')
})

test('treats an unparseable provider report as a mismatch instead of throwing', () => {
  const result = compareFrozenPageSignals({
    beforePayment: snapshot(),
    afterDelivery: snapshot({ capturedAt: '2026-07-26T12:01:00.000Z' }),
    providerReport: { metadata: 'not-a-report' },
  })
  assert.equal(result.status, 'mismatch')
  assert.deepEqual(result.mismatches, [{ path: 'providerReport', kind: 'value' }])
})

test('refuses an internally inconsistent independent snapshot', () => {
  const inconsistent = signals()
  inconsistent.counts.links = 99
  const result = compareFrozenPageSignals({
    beforePayment: snapshot({ signals: inconsistent }),
    afterDelivery: snapshot({ capturedAt: '2026-07-26T12:01:00.000Z' }),
    providerReport: signals(),
  })
  assert.equal(result.status, 'not_comparable')
  assert.equal(result.reason, 'invalid_snapshot_evidence')
})

test('refuses a missing snapshot instead of throwing on untrusted input', () => {
  const result = compareFrozenPageSignals({
    beforePayment: undefined,
    afterDelivery: snapshot({ capturedAt: '2026-07-26T12:01:00.000Z' }),
    providerReport: signals(),
  })
  assert.equal(result.status, 'not_comparable')
  assert.equal(result.reason, 'invalid_snapshot_evidence')
})
