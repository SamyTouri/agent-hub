// Le budget temps du cron quotidien — logique pure, testable sans réseau ni base.
//
// Écrit après un vrai incident : dans la nuit du 2026-07-28 la fonction a été tuée par
// « Task timed out after 60 seconds ». Les sondes avaient été faites et écrites, mais la
// réponse n'est jamais revenue, donc la plateforme a marqué le cron en échec. Ce jour-là
// c'est passé ; la fois suivante le couperet peut tomber ENTRE la sonde et l'écriture, et
// 250 mesures réseau partent à la poubelle.
//
// La cause n'était pas la durée de la sonde. C'était que personne ne comptait le total :
// le budget de 45 s démarrait au début de la sonde, alors qu'IndexNow, la requête de
// keep-alive et la purge s'étaient déjà servis avant, sans plafond. Un budget qui ignore
// ce qui l'a précédé n'est pas un budget.
//
// Trois règles en découlent, et ce module ne fait qu'elles :
//
//   1. Une seule échéance, ancrée à l'entrée de la requête. Chaque étape reçoit ce qui
//      reste, jamais un délai fixe additionné à l'aveugle.
//   2. Une vague ne démarre que si le temps restant peut absorber sa DURÉE MAXIMALE plus
//      l'écriture finale. Une sonde faite mais non écrite est du travail perdu et une
//      mesure de moins sur l'agent de quelqu'un d'autre.
//   3. La durée maximale d'une vague se DÉDUIT des deux essais de la sonde. Un nombre
//      magique se désynchronise le jour où l'on rallonge la seconde chance.

import { PROBE_FIRST_TRY_MS, PROBE_SECOND_TRY_MS } from './endpoint-probe.ts'

/**
 * Plafond déclaré par la route. 300 s est ce que le plan autorise en Fluid compute — le
 * cron registre l'utilise déjà en production. Le passage de 60 s à 300 s ne fait pas
 * travailler la fonction plus longtemps : il enlève un couperet placé plus bas que le
 * travail à faire.
 */
export const DAILY_MAX_DURATION_S = 300

/** Tout le travail doit être terminé ici. Le reste est la marge de sérialisation de la
 *  réponse et des aléas de plateforme. */
export const DAILY_ROUTE_BUDGET_MS = 240_000

/**
 * Durée de vie du bail d'exécution unique, calée sur le plafond de la plateforme.
 *
 * Les deux bornes comptent autant l'une que l'autre. Un bail plus court que le travail
 * qu'il protège serait repris par une seconde invocation pendant que la première écrit
 * encore — exactement la concurrence qu'il existe pour empêcher. Un bail plus long que le
 * plafond survivrait à une invocation que la plateforme a tuée, et bloquerait la tâche
 * pour rien. À 300 s il ne peut faire ni l'un ni l'autre : aucune invocation ne vit plus
 * longtemps, et le travail s'arrête soixante secondes plus tôt.
 */
export const DAILY_LEASE_TTL_MS = DAILY_MAX_DURATION_S * 1_000

/** IndexNow est du référencement, pas de la preuve. Il est borné pour ne pas pouvoir
 *  manger la part de la sonde, qui est la seule étape dont dépend une affirmation
 *  publique sur l'agent d'un tiers. */
export const INDEXNOW_BUDGET_MS = 60_000

/** Réservé à l'écriture groupée des contrôles et à l'historisation des transitions. */
export const FINALIZE_RESERVE_MS = 10_000

/** Marge d'ordonnancement au-dessus des deux essais. */
export const WAVE_SLACK_MS = 2_000

/**
 * Durée maximale d'une vague, quelle que soit sa taille : les hôtes sont sondés en
 * parallèle, donc une vague ne dure jamais plus que l'hôte le plus lent — un premier
 * essai suivi d'une seconde chance patiente.
 */
export const WAVE_MAX_MS = PROBE_FIRST_TRY_MS + PROBE_SECOND_TRY_MS + WAVE_SLACK_MS

/** Une vague ne démarre que si sa pire durée ET l'écriture finale tiennent encore. */
export function canStartWave(remainingMs: number): boolean {
  return remainingMs >= WAVE_MAX_MS + FINALIZE_RESERVE_MS
}

export type ProbePlan = {
  waves: number
  probed: number
  /** Millisecondes écoulées à la fin de la dernière vague, écriture non comprise. */
  elapsedMs: number
  /** Ce qui reste après la dernière vague. Doit toujours couvrir l'écriture finale. */
  leftoverMs: number
  /** Cibles laissées au prochain passage, dites plutôt que tues. */
  deferred: number
}

/**
 * Rejoue exactement la boucle de la route, pour qu'un test puisse prouver l'invariant
 * plutôt que relire une constante : quelle que soit la durée des vagues, la boucle
 * s'arrête en laissant de quoi écrire.
 */
export function planProbeWaves(input: {
  targets: number
  concurrency: number
  /** Temps restant au moment où la sonde commence. */
  budgetMs: number
  /** Durée d'une vague ; utiliser WAVE_MAX_MS pour le pire cas. */
  waveDurationMs: number
}): ProbePlan {
  let elapsedMs = 0
  let waves = 0
  let probed = 0
  for (let index = 0; index < input.targets; index += input.concurrency) {
    if (!canStartWave(input.budgetMs - elapsedMs)) break
    waves += 1
    probed += Math.min(input.concurrency, input.targets - index)
    elapsedMs += input.waveDurationMs
  }
  return {
    waves,
    probed,
    elapsedMs,
    leftoverMs: input.budgetMs - elapsedMs,
    deferred: input.targets - probed,
  }
}
