import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EXTRACTOR_VERSION,
  MAX_CAPTURE_BYTES,
  canonicalCaptureFacts,
  captureCanonicalResponse,
  compareCaptures,
  sha256Hex,
  termsSha256,
  type CanonicalCapture,
} from '../lib/canonical-capture.ts'

const NOW = () => new Date('2026-07-31T12:00:00.000Z')

function fakeFetch(body: string, headers: Record<string, string> = {}, status = 200): typeof fetch {
  return (async () =>
    new Response(new TextEncoder().encode(body), { status, headers })) as unknown as typeof fetch
}

test('the digest covers the exact entity bytes, not our reading of them', async () => {
  const body = '{"price":"0.50","scope":"one brief"}'
  const capture = await captureCanonicalResponse('https://x.dev/offer', {
    now: NOW,
    fetchImpl: fakeFetch(body, { 'content-type': 'application/json' }),
  })
  assert.equal(capture.entity_sha256, sha256Hex(new TextEncoder().encode(body)))
  assert.equal(capture.entity_bytes, body.length)
  assert.equal(capture.http_status, 200)
  assert.equal(capture.capture_failure, undefined)
})

test('origin headers are kept as ORIGIN validators, never as independent time', async () => {
  const capture = await captureCanonicalResponse('https://x.dev/offer', {
    now: NOW,
    fetchImpl: fakeFetch('body', {
      etag: 'W/"abc123"',
      'last-modified': 'Wed, 30 Jul 2026 10:00:00 GMT',
      date: 'Thu, 31 Jul 2026 12:00:00 GMT',
    }),
  })
  assert.equal(capture.origin_validators?.etag, 'W/"abc123"')
  assert.equal(capture.origin_validators?.date, 'Thu, 31 Jul 2026 12:00:00 GMT')
  // Le point entier de la correction du 2026-07-31 : ces en-têtes viennent du vendeur.
  assert.equal(capture.timestamp_independence, 'UNKNOWN')
})

test('timestamp independence stays UNKNOWN even when the capture is perfect', async () => {
  const capture = await captureCanonicalResponse('https://x.dev/offer', { now: NOW, fetchImpl: fakeFetch('ok') })
  assert.equal(capture.entity_sha256 !== undefined, true)
  assert.equal(capture.timestamp_independence, 'UNKNOWN', 'only a third party may promote this')
})

test('a host that does not answer produces a recorded failure, never a silent absence', async () => {
  const capture = await captureCanonicalResponse('https://x.dev/gone', {
    now: NOW,
    fetchImpl: (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch,
  })
  assert.equal(capture.capture_failure, 'no_response')
  assert.equal(capture.entity_sha256, undefined)
  assert.equal(capture.timestamp_independence, 'UNKNOWN')
})

test('an oversized body is refused rather than fingerprinted in part', async () => {
  const capture = await captureCanonicalResponse('https://x.dev/huge', {
    now: NOW,
    fetchImpl: fakeFetch('x'.repeat(MAX_CAPTURE_BYTES + 1)),
  })
  assert.equal(capture.capture_failure, 'too_large')
  assert.equal(capture.entity_sha256, undefined, 'a partial digest would be wrong in silence')
})

test('the terms digest ignores key order and empty fields, and carries the extractor', () => {
  const a = termsSha256({ price: '0.50', network: 'base', asset: 'USDC' })
  const b = termsSha256({ asset: 'USDC', network: 'base', price: '0.50', route: '' })
  assert.equal(a, b)
  assert.notEqual(a, termsSha256({ price: '0.60', network: 'base', asset: 'USDC' }))
  assert.equal(EXTRACTOR_VERSION, 'terms-v1')
})

// --- le verdict à quatre branches ---------------------------------------------------------

const cap = (entity?: string, terms?: string) => ({ entity_sha256: entity, terms_sha256: terms })

test('same bytes and same terms is no observed change, and claims nothing more', () => {
  const v = compareCaptures(cap('a', 't'), cap('a', 't'))
  assert.equal(v.kind, 'no_observed_change')
  assert.match(v.note, /says nothing about whether any promise was kept/)
})

test('bytes moved but terms did not is presentation drift, not a commercial event', () => {
  const v = compareCaptures(cap('a', 't'), cap('b', 't'))
  assert.equal(v.kind, 'presentation_drift')
  assert.match(v.note, /Nothing commercial is observed/)
})

test('both moved is a terms divergence, and it refuses to call itself a breach', () => {
  const v = compareCaptures(cap('a', 't1'), cap('b', 't2'))
  assert.equal(v.kind, 'commercial_terms_divergence')
  assert.match(v.note, /not a breach/)
})

test('identical bytes with a different tuple blames US, never the seller', () => {
  const v = compareCaptures(cap('a', 't1'), cap('a', 't2'))
  assert.equal(v.kind, 'extractor_drift')
  assert.match(v.note, /the change is OURS/)
})

test('a missing commitment is an explicit indeterminate row', () => {
  assert.equal(compareCaptures(cap('a', 't'), cap(undefined, 't')).kind, 'indeterminate')
  assert.equal(compareCaptures(cap('a', undefined), cap('a', 't')).kind, 'indeterminate')
})

// --- ce qui entre dans l'empreinte de l'historique -----------------------------------------

test('clocks stay OUT of the fingerprinted facts, or every pass would write a row', () => {
  const capture: CanonicalCapture = {
    observed_at: '2026-07-31T12:00:00.000Z',
    url: 'https://x.dev/offer',
    http_status: 200,
    entity_sha256: 'abc',
    entity_bytes: 12,
    timestamp_independence: 'UNKNOWN',
    origin_validators: { etag: 'W/"1"', date: 'Thu, 31 Jul 2026 12:00:00 GMT' },
  }
  const facts = canonicalCaptureFacts(capture)
  assert.equal(facts.observed_at, undefined)
  assert.equal(facts.origin_date, undefined, 'the origin Date header would change on every pass')
  assert.equal(facts.entity_sha256, 'abc')
  // Renommé pour qu'un relecteur ne puisse pas le prendre pour une preuve de temps.
  assert.equal(facts.origin_etag, 'W/"1"')
  assert.equal(facts.timestamp_independence, 'UNKNOWN')
})

test('a failed capture is itself a fact, so a disappearance changes the fingerprint', () => {
  const facts = canonicalCaptureFacts({
    observed_at: 'now',
    url: 'https://x.dev/offer',
    timestamp_independence: 'UNKNOWN',
    capture_failure: 'no_response',
  })
  assert.equal(facts.capture_failure, 'no_response')
})
