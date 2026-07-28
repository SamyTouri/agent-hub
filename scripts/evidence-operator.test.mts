// Un seul événement chez un opérateur ne doit pas se lire comme vingt-et-un signaux
// indépendants du marché. C'est arrivé : la cohorte v2 a retenu 21 variantes pays du même
// éditeur dans la strate de disponibilité, sur 40 places. La règle était respectée ;
// l'effet ne l'était pas. Ces tests portent sur la clé d'opérateur et sur son plafond.
import assert from 'node:assert/strict'
import test from 'node:test'

import { isProbeableEndpoint, nextCheck } from '../lib/endpoint-probe.ts'
import {
  emptyTally,
  isPlaceholderHost,
  operatorAtCap,
  operatorKeysOf,
  registrableDomain,
  tallyOperator,
  topConcentration,
} from '../lib/evidence-operator.ts'
import { COHORT_SPEC_V2, COHORT_SPEC_V3, selectCohort, type CandidateSubject } from '../lib/evidence-cohort.ts'

const DOWN = nextCheck(null, { responded: false }, '2026-07-26T10:00:00.000Z')

function silent(overrides: Partial<CandidateSubject> & { handle: string; endpoint: string }): CandidateSubject {
  return {
    agentId: overrides.agentId ?? `id-${overrides.handle}`,
    displayName: null,
    description: 'a server',
    externalSource: 'mcp-registry',
    externalId: overrides.handle,
    repository: null,
    hasRepositoryObservation: false,
    endpointCheck: DOWN,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// The key: strict enough to catch the real case, never merging strangers
// ---------------------------------------------------------------------------

test('a naive two-label key would have merged unrelated operators', () => {
  // Ce cas est dans les données de production : `tippingservice.co.uk`. Sans liste de
  // suffixes, la clé serait `co.uk` et tous les opérateurs britanniques n'en feraient qu'un.
  assert.equal(registrableDomain('tippingservice.co.uk'), 'tippingservice.co.uk')
  assert.equal(registrableDomain('api.tippingservice.co.uk'), 'tippingservice.co.uk')
  assert.equal(registrableDomain('skills-sh.run.mcp.com.ai'), 'mcp.com.ai')
})

test('the twenty-one country variants collapse onto one operator key', () => {
  // Vingt-un hôtes DIFFÉRENTS pour un seul éditeur : une clé par hôte n'aurait rien vu.
  for (const host of ['mcp-dz.wishpool.app', 'inv-ar.wishpool.app', 'logi-au.wishpool.app']) {
    assert.equal(registrableDomain(host), 'wishpool.app')
  }
  assert.deepEqual(
    operatorKeysOf({ handle: 'app.wishpool/algeria-payments-mcp', endpoint: 'https://mcp-dz.wishpool.app/mcp' }),
    { domain: 'wishpool.app', namespace: 'app.wishpool' },
  )
})

test('tenants of a shared platform stay separate operators', () => {
  // L'inverse exact : fusionner deux locataires d'un même tunnel plafonnerait l'un à
  // cause de l'autre, alors qu'ils n'ont rien à voir.
  assert.equal(registrableDomain('funky-starring.trycloudflare.com'), 'funky-starring.trycloudflare.com')
  assert.equal(registrableDomain('other-tunnel.trycloudflare.com'), 'other-tunnel.trycloudflare.com')
  assert.equal(registrableDomain('botcurve-mcp.shhrcgcs.workers.dev'), 'shhrcgcs.workers.dev')
})

test('an address that is already minimal is its own operator', () => {
  assert.equal(registrableDomain('example.com'), 'example.com')
  assert.equal(registrableDomain('viarapidaservices.com'), 'viarapidaservices.com')
  assert.equal(registrableDomain('203.0.113.7'), '203.0.113.7')
  assert.equal(registrableDomain(''), '')
})

test('an unsubstituted template is not an address and is never probed', () => {
  // Le catalogue en contient. Les sonder revenait à écrire publiquement que l'hôte d'un
  // vendeur ne répond pas, alors qu'aucun hôte n'a jamais été publié.
  for (const host of ['{host}', '{api_host}', '{baseurl}', '{hostname}']) {
    assert.equal(isPlaceholderHost(host), true, host)
    assert.equal(isProbeableEndpoint(`https://${host}/mcp`), false, host)
  }
  assert.equal(isProbeableEndpoint('https://real.example.com/mcp'), true)
  assert.equal(operatorKeysOf({ handle: 'a/b', endpoint: 'https://{host}/mcp' }).domain, null)
})

test('a handle without a namespace yields no namespace axis', () => {
  assert.deepEqual(operatorKeysOf({ handle: 'viarapida', endpoint: null }), { domain: null, namespace: null })
})

// ---------------------------------------------------------------------------
// The cap: one operator event can no longer dominate
// ---------------------------------------------------------------------------

test('the cap stops one publisher from owning the availability stratum', () => {
  const rows = [
    ...Array.from({ length: 25 }, (_, i) =>
      silent({
        agentId: `w-${i}`,
        handle: `app.wishpool/country-${String(i).padStart(2, '0')}-mcp`,
        endpoint: `https://mcp-${i}.wishpool.app/mcp`,
      }),
    ),
    ...Array.from({ length: 25 }, (_, i) =>
      silent({
        agentId: `o-${i}`,
        handle: `io.github.other${i}/silent-mcp`,
        endpoint: `https://host.example${i}.com/mcp`,
      }),
    ),
  ]
  const countWishpool = (picks: ReturnType<typeof selectCohort>) =>
    picks.filter((p) => p.stratum === 'availability_watch' && p.handle.startsWith('app.wishpool')).length

  const v2 = selectCohort(rows, { spec: COHORT_SPEC_V2 })
  const v3 = selectCohort(rows, { spec: COHORT_SPEC_V3 })
  assert.ok(countWishpool(v2) > 3, 'v2 is the defect being corrected')
  assert.equal(countWishpool(v3), COHORT_SPEC_V3.availabilityOperatorCap)

  const v3Availability = v3.filter((p) => p.stratum === 'availability_watch')
  assert.ok(v3Availability.length >= 20, 'the freed slots go to other operators, they are not lost')
})

test('subjects already tracked count against the cap', () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    silent({ agentId: `e-${i}`, handle: `app.wishpool/extra-${i}-mcp`, endpoint: `https://extra-${i}.wishpool.app/mcp` }),
  )
  const tracked = ['a', 'b', 'c'].map((letter) => ({
    agentId: `tracked-${letter}`,
    stratum: 'availability_watch' as const,
    selectionFamily: null,
    handle: `app.wishpool/${letter}-mcp`,
    endpoint: `https://${letter}.wishpool.app/mcp`,
  }))
  const picks = selectCohort(rows, { spec: COHORT_SPEC_V3, alreadyTracked: tracked })
  assert.equal(
    picks.filter((p) => p.stratum === 'availability_watch').length,
    0,
    'the cap was already full from history, so nothing more is admitted',
  )
})

test('an ordinary multi-product publisher keeps three subjects, not zero', () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
    silent({ agentId: `p-${i}`, handle: `com.acme/product-${i}-mcp`, endpoint: `https://p${i}.acme.com/mcp` }),
  )
  const picks = selectCohort(rows, { spec: COHORT_SPEC_V3 }).filter((p) => p.stratum === 'availability_watch')
  assert.equal(picks.length, 3, 'capped, not excluded')
})

test('the cap binds on either axis, whichever is stricter', () => {
  const tally = emptyTally()
  tallyOperator(tally, { domain: 'shared.example', namespace: 'ns.one' })
  tallyOperator(tally, { domain: 'shared.example', namespace: 'ns.two' })
  tallyOperator(tally, { domain: 'shared.example', namespace: 'ns.three' })
  // Domaine saturé alors que chaque namespace est à un : le plus strict gagne.
  assert.equal(operatorAtCap(tally, { domain: 'shared.example', namespace: 'ns.four' }, 3), true)
  assert.equal(operatorAtCap(tally, { domain: 'other.example', namespace: 'ns.four' }, 3), false)
  // Et symétriquement pour le namespace.
  const byName = emptyTally()
  for (const domain of ['a.test', 'b.test', 'c.test']) tallyOperator(byName, { domain, namespace: 'same.ns' })
  assert.equal(operatorAtCap(byName, { domain: 'd.test', namespace: 'same.ns' }, 3), true)
})

test('concentration is reportable on both axes', () => {
  const tally = emptyTally()
  for (const host of ['mcp-a.wishpool.app', 'mcp-b.wishpool.app', 'one.example.com']) {
    tallyOperator(tally, operatorKeysOf({ handle: 'app.wishpool/x', endpoint: `https://${host}/mcp` }))
  }
  const top = topConcentration(tally)
  assert.equal(top.by_domain[0].key, 'wishpool.app')
  assert.equal(top.by_domain[0].subjects, 2)
  assert.equal(top.by_namespace[0].subjects, 3)
})
