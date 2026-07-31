import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_CAPTURE_BYTES,
  canonicalCaptureFacts,
  captureCanonicalResponse,
  compareCaptures,
  sha256Hex,
  type CanonicalCapture,
} from '../lib/canonical-capture.ts'

const NOW = () => new Date('2026-07-31T12:00:00.000Z')

function fakeFetch(body: string, headers: Record<string, string> = {}, status = 200): typeof fetch {
  return (async () =>
    new Response(new TextEncoder().encode(body), { status, headers })) as unknown as typeof fetch
}

test('the digest covers the exact bytes served, not our reading of them', async () => {
  const body = '{"price":"0.50","scope":"one brief"}'
  const capture = await captureCanonicalResponse('https://x.dev/offer', {
    now: NOW,
    fetchImpl: fakeFetch(body, { 'content-type': 'application/json' }),
  })
  assert.equal(capture.body_sha256, sha256Hex(new TextEncoder().encode(body)))
  assert.equal(capture.body_bytes, body.length)
  assert.equal(capture.http_status, 200)
  assert.equal(capture.capture_failure, undefined)
})

test('HTTP validators are kept because they date the resource without us', async () => {
  const capture = await captureCanonicalResponse('https://x.dev/offer', {
    now: NOW,
    fetchImpl: fakeFetch('body', {
      etag: 'W/"abc123"',
      'last-modified': 'Wed, 30 Jul 2026 10:00:00 GMT',
      date: 'Thu, 31 Jul 2026 12:00:00 GMT',
    }),
  })
  assert.equal(capture.etag, 'W/"abc123"')
  assert.equal(capture.last_modified, 'Wed, 30 Jul 2026 10:00:00 GMT')
  assert.equal(capture.server_date, 'Thu, 31 Jul 2026 12:00:00 GMT')
})

test('a host that does not answer produces a recorded failure, never a silent absence', async () => {
  const capture = await captureCanonicalResponse('https://x.dev/gone', {
    now: NOW,
    fetchImpl: (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch,
  })
  assert.equal(capture.capture_failure, 'no_response')
  assert.equal(capture.body_sha256, undefined)
  assert.equal(capture.observed_at, '2026-07-31T12:00:00.000Z')
})

test('an oversized body is refused rather than fingerprinted in part', async () => {
  const huge = 'x'.repeat(MAX_CAPTURE_BYTES + 1)
  const capture = await captureCanonicalResponse('https://x.dev/huge', {
    now: NOW,
    fetchImpl: fakeFetch(huge),
  })
  assert.equal(capture.capture_failure, 'too_large')
  assert.equal(capture.body_sha256, undefined, 'a partial digest would be wrong in silence')
})

test('two captures with the same bytes are identical, and that claim stays narrow', () => {
  const a: CanonicalCapture = { observed_at: 'a', url: 'u', body_sha256: 'deadbeef' }
  const b: CanonicalCapture = { observed_at: 'b', url: 'u', body_sha256: 'deadbeef' }
  const verdict = compareCaptures(a, b)
  assert.equal(verdict.kind, 'identical')
  assert.match(verdict.note, /says nothing about whether the promise was kept/)
})

test('different bytes are a divergence, and the note refuses to call it a broken promise', () => {
  const atPayment: CanonicalCapture = { observed_at: 'a', url: 'u', body_sha256: 'aaaa' }
  const now: CanonicalCapture = { observed_at: 'b', url: 'u', body_sha256: 'bbbb' }
  const verdict = compareCaptures(atPayment, now)
  assert.equal(verdict.kind, 'diverged')
  assert.match(verdict.note, /does not by itself prove a broken promise/)
})

test('a missing digest makes the comparison undecidable, never a match and never a divergence', () => {
  const atPayment: CanonicalCapture = { observed_at: 'a', url: 'u', body_sha256: 'aaaa' }
  const now: CanonicalCapture = { observed_at: 'b', url: 'u', capture_failure: 'no_response' }
  const verdict = compareCaptures(atPayment, now)
  assert.equal(verdict.kind, 'undecidable')
})

test('timestamps stay OUT of the fingerprinted facts, or every pass would write a row', () => {
  const capture: CanonicalCapture = {
    observed_at: '2026-07-31T12:00:00.000Z',
    server_date: 'Thu, 31 Jul 2026 12:00:00 GMT',
    url: 'https://x.dev/offer',
    http_status: 200,
    body_sha256: 'abc',
    body_bytes: 12,
    etag: 'W/"1"',
  }
  const facts = canonicalCaptureFacts(capture)
  assert.equal(facts.observed_at, undefined)
  assert.equal(facts.server_date, undefined)
  assert.equal(facts.body_sha256, 'abc')
  assert.equal(facts.etag, 'W/"1"')
})

test('a failed capture is itself a fact, so a disappearance changes the fingerprint', () => {
  const facts = canonicalCaptureFacts({
    observed_at: 'now',
    url: 'https://x.dev/offer',
    capture_failure: 'no_response',
  })
  assert.equal(facts.capture_failure, 'no_response')
})
