// Le garde d'exécution unique du cron quotidien.
//
// Le 2026-07-28, quatre invocations de /api/cron/daily se sont chevauchées : trois tuées
// au plafond de 300 s de la plateforme, la quatrième morte sur le délai d'instruction
// PostgreSQL. Elles sondaient les mêmes hôtes et écrivaient les mêmes lignes en même
// temps, sur un pooler où chaque instance n'a qu'une connexion.
//
// Ce que ces tests prouvent : la DÉCISION du garde et ce qu'elle protège — qui travaille,
// qui repart les mains vides, qui reprend un bail mort, qui a le droit de rendre lequel.
// Le faux client rejoue la sémantique de l'instruction de prise (écrire seulement si le
// bail est libre ou périmé) ; l'atomicité de cette instruction, elle, appartient à
// PostgreSQL et se vérifie contre la base, pas ici — huit connexions distinctes lancées
// ensemble contre la production le 2026-07-28 n'ont produit qu'un seul détenteur.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import type { Sql } from '../lib/db.ts'
import { DAILY_LEASE_NAME, acquireLease, releaseLease, withLease } from '../lib/single-flight.ts'
import { DAILY_LEASE_TTL_MS, DAILY_MAX_DURATION_S, DAILY_ROUTE_BUDGET_MS } from '../lib/probe-budget.ts'

const LEASE = 'cron:test'
const TTL_MS = 300_000
const START = Date.parse('2026-07-28T03:00:00.000Z')

type LockRow = { name: string; holder: string; acquired_at: Date; expires_at: Date }

/**
 * Faux client postgres.js réduit à la table des baux.
 *
 * L'horloge est celle de la BASE et le test la pilote : c'est le seul temps qui compte,
 * deux instances serverless n'ayant aucune raison d'être d'accord sur l'heure. La prise de
 * bail reproduit la clause `where l.expires_at <= now()` et rien d'autre — dès qu'il en
 * ferait plus, ce faux client se testerait lui-même.
 */
function lockStore() {
  const rows = new Map<string, LockRow>()
  const statements: string[] = []
  const store = {
    now: START,
    failEverythingWith: null as Error | null,
    failDeleteWith: null as Error | null,
    statements,
    rows,
    sql: null as unknown as Sql,
    advance(ms: number) {
      store.now += ms
    },
  }

  const call = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(' ? ')
    statements.push(text.trim().split(/\s+/).slice(0, 3).join(' '))
    if (store.failEverythingWith) return Promise.reject(store.failEverythingWith)

    if (text.includes('insert into cron_locks')) {
      const name = String(values[0])
      const holder = String(values[1])
      const ttlSeconds = Number(values[2])
      const current = rows.get(name)
      if (current && current.expires_at.getTime() > store.now) return Promise.resolve([])
      const row: LockRow = {
        name,
        holder,
        acquired_at: new Date(store.now),
        expires_at: new Date(store.now + ttlSeconds * 1_000),
      }
      rows.set(name, row)
      return Promise.resolve([{ holder, acquired_at: row.acquired_at, expires_at: row.expires_at }])
    }

    if (text.includes('delete from cron_locks')) {
      if (store.failDeleteWith) return Promise.reject(store.failDeleteWith)
      const name = String(values[0])
      const row = rows.get(name)
      const mine = row !== undefined && row.holder === String(values[1])
      if (mine) rows.delete(name)
      return Promise.resolve(Object.assign([], { count: mine ? 1 : 0 }))
    }

    if (text.includes('from cron_locks')) {
      const row = rows.get(String(values[0]))
      return Promise.resolve(
        row ? [{ holder: row.holder, acquired_at: row.acquired_at, expires_at: row.expires_at }] : [],
      )
    }

    throw new Error(`unexpected statement: ${text}`)
  }

  store.sql = call as unknown as Sql
  return store
}

// ---------------------------------------------------------------------------
// Prise, refus, reprise
// ---------------------------------------------------------------------------

test('the first invocation takes the lease and dates it from the database clock', async () => {
  const store = lockStore()
  const lease = await acquireLease(store.sql, LEASE, TTL_MS, 'first')
  assert.equal(lease.status, 'held')
  assert.ok(lease.status === 'held')
  assert.equal(lease.holder, 'first')
  assert.equal(lease.acquiredAt, new Date(START).toISOString())
  assert.equal(lease.expiresAt, new Date(START + TTL_MS).toISOString())
})

test('a concurrent invocation is refused and told who is working', async () => {
  const store = lockStore()
  await acquireLease(store.sql, LEASE, TTL_MS, 'first')
  store.advance(1_000)

  const second = await acquireLease(store.sql, LEASE, TTL_MS, 'second')
  assert.ok(second.status === 'busy')
  assert.equal(second.lock?.holder, 'first', 'the refusal must name the holder, not just say no')
  assert.equal(second.lock?.acquiredAt, new Date(START).toISOString())
  assert.equal(store.rows.get(LEASE)?.holder, 'first', 'a refused caller must not overwrite the lease')
})

test('a refused caller waits for nobody and touches nothing else', async () => {
  const store = lockStore()
  await acquireLease(store.sql, LEASE, TTL_MS, 'first')
  store.statements.length = 0

  const started = Date.now()
  const run = await withLease(store.sql, LEASE, TTL_MS, async () => {
    throw new Error('the work must never run under a refused lease')
  })

  assert.equal(run.status, 'busy')
  assert.ok(Date.now() - started < 1_000, 'the refusal is immediate: no waiting on the holder')
  // Une tentative de prise, une lecture du détenteur. Rien d'autre : ni sonde, ni écriture.
  assert.deepEqual(store.statements, ['insert into cron_locks', 'select holder, acquired_at,'])
})

test('an expired lease is taken over instead of blocking the task forever', async () => {
  // Le cas réel : la plateforme tue une invocation, personne ne rend le bail. Sans reprise,
  // le cron quotidien serait mort définitivement au premier dépassement.
  const store = lockStore()
  await acquireLease(store.sql, LEASE, TTL_MS, 'killed')
  store.advance(TTL_MS)

  const next = await acquireLease(store.sql, LEASE, TTL_MS, 'next-day')
  assert.equal(next.status, 'held')
  assert.equal(store.rows.get(LEASE)?.holder, 'next-day')
})

test('a lease is still held one millisecond before it expires', async () => {
  const store = lockStore()
  await acquireLease(store.sql, LEASE, TTL_MS, 'holder')
  store.advance(TTL_MS - 1)
  const early = await acquireLease(store.sql, LEASE, TTL_MS, 'too-early')
  assert.equal(early.status, 'busy')
})

// ---------------------------------------------------------------------------
// Rendre le bail — le sien, et seulement le sien
// ---------------------------------------------------------------------------

test('releasing frees the task immediately for a legitimate re-run', async () => {
  const store = lockStore()
  await acquireLease(store.sql, LEASE, TTL_MS, 'first')

  assert.deepEqual(await releaseLease(store.sql, LEASE, 'first'), { released: true })
  const again = await acquireLease(store.sql, LEASE, TTL_MS, 'second')
  assert.equal(again.status, 'held', 'a finished run must not block the next one until its TTL')
})

test('a late invocation cannot release the lease of the one that replaced it', async () => {
  // Sans le jeton du détenteur, une invocation zombie libérerait le tour de garde d'une
  // autre EN PLEIN TRAVAIL — et on retomberait exactement dans la concurrence de départ.
  const store = lockStore()
  await acquireLease(store.sql, LEASE, TTL_MS, 'zombie')
  store.advance(TTL_MS)
  await acquireLease(store.sql, LEASE, TTL_MS, 'successor')

  assert.deepEqual(await releaseLease(store.sql, LEASE, 'zombie'), { released: false })
  assert.equal(store.rows.get(LEASE)?.holder, 'successor', 'the successor keeps its lease')
})

test('a failed release never breaks the run that succeeded', async () => {
  const store = lockStore()
  store.failDeleteWith = new Error('connection reset')

  const run = await withLease(store.sql, LEASE, TTL_MS, async () => ({ probed: 42 }))
  assert.ok(run.status === 'held')
  assert.deepEqual(run.result, { probed: 42 }, 'the work result survives a release failure')
  assert.equal(run.release.released, false)
  assert.match(String(run.release.error), /connection reset/)
})

// ---------------------------------------------------------------------------
// Ce que le bail fait autour du travail
// ---------------------------------------------------------------------------

test('the work runs once, under the lease, and reports the release', async () => {
  const store = lockStore()
  let runs = 0
  let refusedWhileWorking: boolean | null = null

  const run = await withLease(store.sql, LEASE, TTL_MS, async () => {
    runs += 1
    // Pendant le travail, le bail tient : un autre appelant repart les mains vides.
    refusedWhileWorking = (await acquireLease(store.sql, LEASE, TTL_MS, 'intruder')).status === 'busy'
    return { ok: true }
  })

  assert.equal(runs, 1)
  assert.equal(refusedWhileWorking, true)
  assert.ok(run.status === 'held')
  assert.equal(run.release.released, true)
  assert.equal(store.rows.size, 0, 'nothing is left behind')
})

test('a failing run releases its lease before the error propagates', async () => {
  // Une panne d'un jour ne doit pas condamner le cycle du lendemain.
  const store = lockStore()
  const boom = new Error('probe exploded')
  await assert.rejects(
    withLease(store.sql, LEASE, TTL_MS, async () => {
      throw boom
    }),
    (error: unknown) => error === boom,
  )
  assert.equal(store.rows.size, 0, 'the lease is released even when the work fails')
})

test('an unusable lock table is a lease failure, never a work failure', async () => {
  // Distinction qui compte pour l'opérateur : la migration manquante et la sonde cassée
  // n'ont ni la même cause ni le même correctif.
  const store = lockStore()
  store.failEverythingWith = Object.assign(new Error('relation "cron_locks" does not exist'), {
    code: '42P01',
  })
  let ran = false

  const run = await withLease(store.sql, LEASE, TTL_MS, async () => {
    ran = true
    return { ok: true }
  })

  assert.ok(run.status === 'unavailable')
  assert.match(run.error, /cron_locks/)
  assert.equal(ran, false, 'the work must not run when the guard cannot prove it is alone')
})

test('two invocations racing on a free lease produce exactly one worker', async () => {
  // Le faux client sérialise comme le fait l'instruction unique côté PostgreSQL : ce test
  // porte sur notre décision face à un refus, pas sur l'atomicité, qui appartient au moteur.
  const store = lockStore()
  let workers = 0
  const work = async () => {
    workers += 1
    return { ok: true }
  }
  const [a, b] = await Promise.all([
    withLease(store.sql, LEASE, TTL_MS, work),
    withLease(store.sql, LEASE, TTL_MS, work),
  ])

  assert.equal(workers, 1, 'only one invocation may do the work')
  assert.deepEqual([a.status, b.status].sort(), ['busy', 'held'])
})

// ---------------------------------------------------------------------------
// Les bornes du bail, et le fait que la route s'en serve avant de travailler
// ---------------------------------------------------------------------------

test('the lease outlives the work it protects and dies with the platform ceiling', () => {
  // Trop court, il serait repris pendant que la première invocation écrit encore. Trop
  // long, il survivrait à une invocation tuée et bloquerait la tâche pour rien.
  assert.ok(DAILY_LEASE_TTL_MS >= DAILY_ROUTE_BUDGET_MS, 'a lease must not expire mid-run')
  assert.ok(DAILY_LEASE_TTL_MS <= DAILY_MAX_DURATION_S * 1_000, 'a lease must not outlive a killed run')
})

test('the daily route takes the lease before it does any work', () => {
  // Régression possible en une ligne : remonter une requête au-dessus du garde suffirait à
  // faire travailler une invocation concurrente. Ce test lit la route elle-même.
  const route = readFileSync(new URL('../app/api/cron/daily/route.ts', import.meta.url), 'utf8')
  const start = route.indexOf('export async function GET')
  assert.ok(start > 0)
  const handler = route.slice(start, start + route.slice(start).search(/\r?\n\}\r?\n/))

  assert.ok(handler.includes('withLease('), 'the daily route must run under a lease')
  assert.ok(handler.includes('DAILY_LEASE_NAME'), 'the route must use the shared lease name')
  assert.equal(DAILY_LEASE_NAME, 'cron:daily')
  // Aucun travail dans le corps du handler : tout passe par la fonction appelée sous bail.
  for (const work of ['sql`', 'submitIndexNow(', 'probeEndpoints(']) {
    assert.ok(!handler.includes(work), `${work} must live under the lease, not beside it`)
  }
  // Et l'autorisation reste la toute première chose vérifiée.
  assert.ok(
    handler.indexOf('authorization') < handler.indexOf('withLease('),
    'the authorization check must stay ahead of everything',
  )
})
