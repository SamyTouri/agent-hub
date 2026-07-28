// Exécution unique d'une tâche planifiée, garantie entre instances.
//
// Écrit après l'incident du 2026-07-28 : quatre invocations de /api/cron/daily se sont
// chevauchées. Trois ont atteint le plafond de 300 s de la plateforme, la quatrième est
// morte sur le délai d'instruction PostgreSQL. Toutes sondaient les mêmes hôtes et
// écrivaient les mêmes lignes en même temps, alors que chaque instance ne dispose que
// d'une connexion vers le pooler. Le journal de preuves a tenu, mais le cycle n'a rien
// produit d'exploitable — et une invocation concurrente ne coûte pas seulement du temps :
// elle sonde une deuxième fois l'agent d'un tiers pour rien.
//
// Trois contraintes façonnent la solution, et aucune n'est négociable ici :
//
//   1. Le garde doit valoir ENTRE instances. Un booléen de processus ne protège rien :
//      deux fonctions serverless ne partagent aucune mémoire.
//   2. Il doit traverser PgBouncer en mode transaction. `pg_advisory_lock` est lié à une
//      SESSION, et derrière ce pooler la session ne nous appartient pas : elle retourne
//      au pool après chaque instruction et peut servir un autre client, verrou compris.
//   3. Il ne peut pas tenir une transaction ouverte. `pg_advisory_xact_lock` mourrait
//      avec sa transaction, et garder celle-ci ouverte pendant quatre minutes
//      monopoliserait l'unique connexion dont la tâche a besoin pour travailler.
//
// D'où un BAIL daté plutôt qu'un verrou : une ligne qui dit « telle invocation détient
// telle tâche jusqu'à telle heure ». La prise est une seule instruction atomique, donc
// elle survit au pooler ; l'échéance est une donnée, donc elle survit à la mort du
// détenteur. Une invocation tuée par la plateforme ne bloque personne au-delà de son bail.

import { randomUUID } from 'node:crypto'

import type { Sql } from './db.ts'

/**
 * Le bail des tâches qui MODIFIENT LE CATALOGUE — partagé, délibérément.
 *
 * Un bail nomme la ressource protégée, pas la route qui le prend. L'import de registre et
 * l'entretien quotidien écrivent tous les deux dans `agents` : leur donner chacun le sien
 * aurait empêché chaque tâche de se marcher dessus elle-même tout en laissant intact le
 * cas où les deux écrivent ensemble sur l'unique connexion du pooler. Ils contendent donc
 * sur ce nom-là.
 *
 * Le coût est assumé : si l'import déborde jusqu'à l'heure de l'entretien, l'entretien
 * saute son cycle plutôt que d'écrire par-dessus. Une heure sépare les deux dans le
 * planning et l'import est borné bien en deçà, donc le cas reste théorique sur la
 * planification et ne mord que sur les lancements manuels — ceux qui ont causé l'incident.
 */
export const CATALOGUE_LEASE_NAME = 'cron:catalogue'

/**
 * Durée de vie du bail, calée sur le plafond de durée déclaré par les DEUX routes.
 *
 * Les deux bornes comptent autant l'une que l'autre. Un bail plus court que le travail
 * qu'il protège serait repris pendant que le détenteur écrit encore — exactement la
 * concurrence qu'il existe pour empêcher. Un bail plus long que le plafond survivrait à
 * une invocation que la plateforme a tuée et bloquerait la tâche pour rien. Un test relit
 * les deux routes pour que ce nombre ne puisse pas se désynchroniser d'elles.
 */
export const CATALOGUE_LEASE_TTL_MS = 300_000

/** Ce qu'on peut dire du détenteur en place, sans rien deviner. */
export type LeaseHolder = {
  holder: string
  acquiredAt: string
  expiresAt: string
}

export type AcquireResult =
  | { status: 'held'; holder: string; acquiredAt: string; expiresAt: string }
  /** `lock` est null si le bail a été rendu entre notre échec et notre lecture. */
  | { status: 'busy'; lock: LeaseHolder | null }

/** Rendre le bail ne doit JAMAIS transformer un cycle réussi en erreur. */
export type ReleaseResult = { released: boolean; error?: string }

/**
 * Les trois issues possibles, et surtout : `busy` et `unavailable` ne peuvent pas être
 * confondues. « La tâche tourne déjà » est un résultat normal ; « je n'arrive pas à savoir
 * si elle tourne » est une panne. Les mélanger enverrait un opérateur regarder la mauvaise
 * chose le jour où ça compte.
 */
export type LeaseRun<T> =
  | { status: 'busy'; lock: LeaseHolder | null }
  | { status: 'unavailable'; error: string }
  | { status: 'held'; holder: string; expiresAt: string; release: ReleaseResult; result: T }

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function message(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : 'unknown error'
}

/**
 * Prend le bail, ou dit qui le détient.
 *
 * Tout tient dans une instruction : `on conflict do update ... where expires_at <= now()`
 * est évalué sous le verrou de ligne pris par le moteur, donc deux invocations
 * simultanées ne peuvent pas gagner ensemble — la seconde ne reçoit aucune ligne. Le
 * temps de référence est celui de la BASE, jamais l'horloge de la fonction : deux
 * instances serverless n'ont aucune raison d'être d'accord sur l'heure.
 *
 * Ne rattrape rien : une base injoignable ou une table absente doit remonter à l'appelant,
 * qui décide. Un garde qui échoue en silence laisserait passer exactement ce qu'il existe
 * pour empêcher.
 */
export async function acquireLease(
  sql: Sql,
  name: string,
  ttlMs: number,
  holder: string = randomUUID(),
): Promise<AcquireResult> {
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
  const [taken] = await sql`
    insert into cron_locks as l (name, holder, acquired_at, expires_at)
    values (${name}, ${holder}, now(), now() + make_interval(secs => ${ttlSeconds}::int))
    on conflict (name) do update
       set holder = excluded.holder,
           acquired_at = excluded.acquired_at,
           expires_at = excluded.expires_at
     where l.expires_at <= now()
    returning holder, acquired_at, expires_at
  `
  if (taken) {
    return {
      status: 'held',
      holder: String(taken.holder),
      acquiredAt: iso(taken.acquired_at),
      expiresAt: iso(taken.expires_at),
    }
  }

  // Refus : on lit le détenteur pour qu'un opérateur voie DEPUIS QUAND la tâche tourne,
  // au lieu de deviner. Séquentiel, comme toute requête vers ce pooler.
  const [current] = await sql`
    select holder, acquired_at, expires_at from cron_locks where name = ${name}
  `
  if (!current) return { status: 'busy', lock: null }
  return {
    status: 'busy',
    lock: {
      holder: String(current.holder),
      acquiredAt: iso(current.acquired_at),
      expiresAt: iso(current.expires_at),
    },
  }
}

/**
 * Rend le bail, et seulement le nôtre.
 *
 * La clause sur le détenteur est une protection réelle : si notre bail avait expiré et
 * qu'une autre invocation l'avait repris, supprimer la ligne libérerait SON tour de garde
 * au milieu de son travail. Les erreurs sont capturées ici, jamais propagées — au pire
 * le bail s'éteint tout seul à son échéance, ce qui est le comportement prévu.
 */
export async function releaseLease(sql: Sql, name: string, holder: string): Promise<ReleaseResult> {
  try {
    const result = await sql`delete from cron_locks where name = ${name} and holder = ${holder}`
    return { released: result.count > 0 }
  } catch (error) {
    return { released: false, error: message(error) }
  }
}

/**
 * Exécute `run` sous bail, ou rend la main immédiatement si la tâche tourne déjà.
 *
 * L'appelant refusé ne fait aucun réseau, aucune écriture, et n'attend pas le détenteur.
 * Un échec du travail, lui, remonte tel quel : seul l'échec de la PRISE devient
 * `unavailable`, sinon une sonde cassée passerait pour un problème de concurrence. Le bail
 * est rendu dans les deux cas, sinon une erreur d'un jour condamnerait le cycle du
 * lendemain jusqu'à l'échéance.
 */
export async function withLease<T>(
  sql: Sql,
  name: string,
  ttlMs: number,
  run: () => Promise<T>,
): Promise<LeaseRun<T>> {
  let lease: AcquireResult
  try {
    lease = await acquireLease(sql, name, ttlMs)
  } catch (error) {
    return { status: 'unavailable', error: message(error) }
  }
  if (lease.status === 'busy') return { status: 'busy', lock: lease.lock }

  try {
    const result = await run()
    const release = await releaseLease(sql, name, lease.holder)
    return { status: 'held', holder: lease.holder, expiresAt: lease.expiresAt, release, result }
  } catch (error) {
    await releaseLease(sql, name, lease.holder)
    throw error
  }
}
