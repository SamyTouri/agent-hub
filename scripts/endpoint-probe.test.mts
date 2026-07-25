// Fraîcheur des endpoints : la logique publique doit être exacte, parce qu'elle affirme
// en public qu'un agent tiers a disparu. Un faux positif accuse à tort ; un faux négatif
// laisse un endpoint mort affiché comme joignable, ce que le premier dossier reproche.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  UNREACHABLE_AFTER,
  describeStatus,
  isProbeableEndpoint,
  nextCheck,
  readStatus,
  type EndpointCheck,
} from '../lib/endpoint-probe.ts'

const T1 = '2026-07-25T10:00:00.000Z'
const T2 = '2026-07-26T10:00:00.000Z'
const T3 = '2026-07-27T10:00:00.000Z'

test('any HTTP answer counts as alive, including a refusal', () => {
  for (const status of [200, 401, 404, 405, 500]) {
    const check = nextCheck(null, { responded: true, status }, T1)
    assert.equal(check.responded, true)
    assert.equal(check.status, status)
    assert.equal(check.consecutive_failures, 0)
    assert.equal(readStatus(check).kind, 'responding')
  }
})

test('a single miss is never published as a disappearance', () => {
  const check = nextCheck(null, { responded: false }, T1)
  assert.equal(check.consecutive_failures, 1)
  assert.equal(readStatus(check).kind, 'flaky')
  assert.match(describeStatus(readStatus(check)), /not a disappearance/)
})

test('failures accumulate and keep the date of the first one', () => {
  const first = nextCheck(null, { responded: false }, T1)
  const second = nextCheck(first, { responded: false }, T2)
  assert.equal(second.consecutive_failures, 2)
  assert.equal(second.failing_since, T1, 'the outage starts at the first miss, not the last')
  const status = readStatus(second)
  assert.equal(status.kind, 'unreachable')
  assert.deepEqual(status, { kind: 'unreachable', since: '2026-07-25', failures: 2 })
})

test('the threshold is the one the public text relies on', () => {
  let check: EndpointCheck | null = null
  for (let i = 0; i < UNREACHABLE_AFTER - 1; i++) check = nextCheck(check, { responded: false }, T1)
  assert.equal(readStatus(check).kind, 'flaky')
  check = nextCheck(check, { responded: false }, T2)
  assert.equal(readStatus(check).kind, 'unreachable')
})

test('one answer clears the whole outage', () => {
  const failing = nextCheck(nextCheck(null, { responded: false }, T1), { responded: false }, T2)
  assert.equal(readStatus(failing).kind, 'unreachable')
  const recovered = nextCheck(failing, { responded: true, status: 200 }, T3)
  assert.equal(recovered.consecutive_failures, 0)
  assert.equal(recovered.failing_since, undefined)
  assert.equal(readStatus(recovered).kind, 'responding')
})

test('never checked is stated, not hidden behind silence', () => {
  assert.equal(readStatus(null).kind, 'unchecked')
  assert.equal(readStatus(undefined).kind, 'unchecked')
  assert.equal(readStatus({} as EndpointCheck).kind, 'unchecked')
  assert.match(describeStatus({ kind: 'unchecked' }), /have not checked/)
})

test('a responding host is never described as proof of quality', () => {
  const text = describeStatus({ kind: 'responding', checkedOn: '2026-07-25' })
  assert.match(text, /nothing about delivery or quality/)
})

test('only public http hosts are probed', () => {
  assert.equal(isProbeableEndpoint('https://example.com/mcp'), true)
  assert.equal(isProbeableEndpoint('http://example.com'), true)
  for (const bad of [
    null,
    undefined,
    '',
    'not a url',
    'ftp://example.com',
    'file:///etc/passwd',
    'http://localhost:3000',
    'https://service.local',
    'http://127.0.0.1',
    'http://169.254.169.254/latest/meta-data',
  ]) {
    assert.equal(isProbeableEndpoint(bad), false, `${bad} must not be probed`)
  }
})
