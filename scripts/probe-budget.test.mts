// Le cron quotidien a été tué par la plateforme dans la nuit du 2026-07-28 : les sondes
// faites, écrites, et la réponse jamais rendue — donc un cron marqué en échec, et la fois
// suivante le couperet pouvait tomber avant l'écriture. Ces tests portent sur l'invariant
// qui l'empêche, pas sur la valeur des constantes : quelle que soit la durée des vagues,
// la boucle s'arrête en laissant de quoi écrire, et le total tient sous le plafond.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  DAILY_MAX_DURATION_S,
  DAILY_ROUTE_BUDGET_MS,
  FINALIZE_RESERVE_MS,
  INDEXNOW_BUDGET_MS,
  WAVE_MAX_MS,
  WAVE_SLACK_MS,
  canStartWave,
  planProbeWaves,
} from '../lib/probe-budget.ts'
import { PROBE_FIRST_TRY_MS, PROBE_SECOND_TRY_MS } from '../lib/endpoint-probe.ts'

/** Les valeurs réelles de la route. */
const TARGETS = 290 // 250 du catalogue + jusqu'à 40 de la cohorte
const CONCURRENCY = 125

// ---------------------------------------------------------------------------
// L'invariant : jamais de sonde faite sans écriture possible
// ---------------------------------------------------------------------------

test('the loop always stops while there is still time to write what it probed', () => {
  // Une vague ne peut pas durer plus que WAVE_MAX_MS : les hôtes sont sondés en parallèle
  // et chaque essai porte son propre AbortSignal.timeout. Le balayage couvre donc de la
  // vague instantanée au pire cas, et vérifie la seule promesse qui compte — il reste
  // toujours de quoi écrire ce qui vient d'être mesuré.
  for (const waveDurationMs of [0, 500, 3_000, 7_000, WAVE_MAX_MS - 1, WAVE_MAX_MS]) {
    for (let budgetMs = 0; budgetMs <= DAILY_ROUTE_BUDGET_MS; budgetMs += 5_000) {
      for (const targets of [0, 1, CONCURRENCY, TARGETS, 4_000]) {
        const plan = planProbeWaves({ targets, concurrency: CONCURRENCY, budgetMs, waveDurationMs })
        if (plan.waves === 0) {
          assert.equal(plan.probed, 0)
          continue
        }
        assert.ok(
          plan.leftoverMs >= FINALIZE_RESERVE_MS,
          `only ${plan.leftoverMs} ms left for the write after ${plan.waves} wave(s) of ${waveDurationMs} ms on a ${budgetMs} ms budget`,
        )
        assert.ok(plan.elapsedMs <= budgetMs, `budget ${budgetMs} exceeded: ${plan.elapsedMs} elapsed`)
        assert.equal(plan.probed + plan.deferred, targets, 'every target is either probed or reported as deferred')
      }
    }
  }
})

test('a wave never starts unless its worst case and the final write both fit', () => {
  assert.equal(canStartWave(WAVE_MAX_MS + FINALIZE_RESERVE_MS), true)
  assert.equal(canStartWave(WAVE_MAX_MS + FINALIZE_RESERVE_MS - 1), false)
  assert.equal(canStartWave(0), false)
  assert.equal(canStartWave(-5_000), false, 'an overrun must not start one more wave')
})

test('the last wave the loop allows still finishes inside the route budget', () => {
  // Le pire cas exact : une vague démarrée au tout dernier instant autorisé.
  const lastStart = DAILY_ROUTE_BUDGET_MS - WAVE_MAX_MS - FINALIZE_RESERVE_MS
  assert.equal(canStartWave(DAILY_ROUTE_BUDGET_MS - lastStart), true)
  const endOfWave = lastStart + WAVE_MAX_MS
  assert.ok(endOfWave + FINALIZE_RESERVE_MS <= DAILY_ROUTE_BUDGET_MS)
})

test('the whole route budget, worst case included, stays well under the platform ceiling', () => {
  const ceilingMs = DAILY_MAX_DURATION_S * 1_000
  // Même en dépassant l'échéance d'une vague entière et de l'écriture, on reste sous le
  // plafond : c'est la marge qui manquait quand la route était déclarée à 60 s.
  assert.ok(DAILY_ROUTE_BUDGET_MS + WAVE_MAX_MS + FINALIZE_RESERVE_MS < ceilingMs)
  assert.ok(DAILY_ROUTE_BUDGET_MS < ceilingMs * 0.9, 'the budget must not creep up to the ceiling')
})

test('the pre-probe phase cannot starve the probe of a single wave', () => {
  // IndexNow est borné, et même en dépassant son budget d'un lot complet (30 s) il reste
  // de quoi sonder. C'est l'étape qui avait mangé la sonde le 2026-07-28.
  const worstPreProbe = INDEXNOW_BUDGET_MS + 30_000 + 5_000
  const plan = planProbeWaves({
    targets: TARGETS,
    concurrency: CONCURRENCY,
    budgetMs: DAILY_ROUTE_BUDGET_MS - worstPreProbe,
    waveDurationMs: WAVE_MAX_MS,
  })
  assert.ok(plan.waves >= 1, 'the cohort must be probed even on the worst pre-probe day')
  assert.ok(plan.probed >= CONCURRENCY)
})

// ---------------------------------------------------------------------------
// Ce que le budget doit permettre en pratique
// ---------------------------------------------------------------------------

test('an ordinary day probes the whole batch, cohort included', () => {
  const plan = planProbeWaves({
    targets: TARGETS,
    concurrency: CONCURRENCY,
    budgetMs: DAILY_ROUTE_BUDGET_MS - 15_000,
    waveDurationMs: WAVE_MAX_MS,
  })
  assert.equal(plan.probed, TARGETS)
  assert.equal(plan.deferred, 0)
  assert.ok(plan.leftoverMs >= FINALIZE_RESERVE_MS)
})

test('the old sixty-second budget could not have held the same work', () => {
  // Régression historique : c'est exactement la configuration qui a été tuée.
  const plan = planProbeWaves({
    targets: TARGETS,
    concurrency: CONCURRENCY,
    budgetMs: 45_000,
    waveDurationMs: WAVE_MAX_MS,
  })
  assert.ok(plan.probed < TARGETS, 'at 45 s of probe budget the batch never fit')
  assert.ok(plan.deferred > 0)
})

test('what does not fit is reported as deferred, never silently dropped', () => {
  const plan = planProbeWaves({
    targets: TARGETS,
    concurrency: CONCURRENCY,
    budgetMs: WAVE_MAX_MS + FINALIZE_RESERVE_MS,
    waveDurationMs: WAVE_MAX_MS,
  })
  assert.equal(plan.waves, 1)
  assert.equal(plan.probed, CONCURRENCY)
  assert.equal(plan.deferred, TARGETS - CONCURRENCY)
})

test('a budget too small for one wave probes nothing rather than half a wave', () => {
  const plan = planProbeWaves({
    targets: TARGETS,
    concurrency: CONCURRENCY,
    budgetMs: WAVE_MAX_MS,
    waveDurationMs: WAVE_MAX_MS,
  })
  assert.equal(plan.waves, 0)
  assert.equal(plan.probed, 0)
  assert.equal(plan.deferred, TARGETS)
})

// ---------------------------------------------------------------------------
// La durée d'une vague se déduit de la sonde, elle ne se recopie pas
// ---------------------------------------------------------------------------

test('the declared platform ceiling and the budget module cannot drift apart', () => {
  // Next analyse `maxDuration` statiquement et refuse une constante importée, donc la
  // route porte un littéral. Ce test est le seul lien entre les deux : sans lui, changer
  // l'un sans l'autre remettrait silencieusement un couperet sous le travail à faire.
  const route = readFileSync(new URL('../app/api/cron/daily/route.ts', import.meta.url), 'utf8')
  const declared = /export const maxDuration = (\d+)/.exec(route)
  assert.ok(declared, 'the daily route must declare maxDuration')
  assert.equal(Number(declared[1]), DAILY_MAX_DURATION_S)
})

test('the wave ceiling follows the probe attempts instead of being a magic number', () => {
  // Si la seconde chance est rallongée un jour, la réserve suit toute seule.
  assert.equal(WAVE_MAX_MS, PROBE_FIRST_TRY_MS + PROBE_SECOND_TRY_MS + WAVE_SLACK_MS)
  assert.ok(WAVE_MAX_MS > PROBE_FIRST_TRY_MS + PROBE_SECOND_TRY_MS, 'scheduling slack is included')
})
