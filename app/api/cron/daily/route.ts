import { getSql, type Sql } from '@/lib/db'
import { submitIndexNow, HOST } from '@/lib/indexnow'
import {
  UNREACHABLE_AFTER,
  isProbeableEndpoint,
  nextCheck,
  probeWithSecondChance,
  type EndpointCheck,
} from '@/lib/endpoint-probe'
import { EVIDENCE_SCHEMA_VERSION, availabilityFacts, type ObservationInput } from '@/lib/evidence-history'
import { appendObservations, loadActiveCohort, type CohortMember } from '@/lib/evidence-store'
import {
  DAILY_ROUTE_BUDGET_MS,
  FINALIZE_RESERVE_MS,
  INDEXNOW_BUDGET_MS,
  canStartWave,
} from '@/lib/probe-budget'
import { CATALOGUE_LEASE_NAME, CATALOGUE_LEASE_TTL_MS, withLease } from '@/lib/single-flight'

export const runtime = 'nodejs'
// Fluid compute : le plan autorise 300 s, et le cron registre s'en sert déjà. À 60 s la
// fonction a été tuée en pleine exécution le 2026-07-28 — les sondes écrites, la réponse
// perdue, donc le cron marqué en échec. Le couperet était placé plus bas que le travail.
//
// Littéral obligatoire : Next analyse statiquement cette valeur et refuse la constante
// importée. DAILY_MAX_DURATION_S en tient la copie côté budget, et un test vérifie que
// les deux ne divergent pas.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

// Cron quotidien (vercel.json, Hobby) — l'import registre vit dans son propre
// cron /api/cron/registry (2 h), une heure AVANT celui-ci : ses upserts touchent
// updated_at, donc l'étape IndexNow ci-dessous soumet les fiches fraîches.
// 1. requête keep-alive — évite la pause Supabase free tier après 7 j d'inactivité
// 2. IndexNow sur les URLs modifiées depuis 25 h (fenêtre > 24 h pour couvrir la dérive du cron)
// 3. purge des crawler_hits > 60 jours
// 4. une seule passe de sonde : cohorte suivie d'abord, rotation du catalogue ensuite,
//    puis historisation des seules transitions de disponibilité de la cohorte
//
// Tout cela sous bail : une seule invocation travaille à la fois (voir lib/single-flight).
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // UNE échéance, ancrée ici. Chaque étape reçoit ce qui reste : c'est l'absence de ce
  // point d'ancrage qui a fait dépasser la fonction, le budget de la sonde ne comptant
  // que son propre temps alors qu'IndexNow s'était déjà servi avant elle.
  const startedAt = Date.now()
  const deadlineAt = startedAt + DAILY_ROUTE_BUDGET_MS

  const sql = getSql()

  // Le bail est pris AVANT tout travail : une invocation concurrente ne doit sonder aucun
  // hôte, n'écrire aucune ligne et n'attendre personne. Le 2026-07-28, quatre invocations
  // simultanées se sont mutuellement affamées sur l'unique connexion du pooler — trois
  // tuées à 300 s, une sur le délai d'instruction — pour un cycle inexploitable.
  // Le bail est PARTAGÉ avec l'import de registre : les deux écrivent dans `agents`.
  // Une panne du TRAVAIL, elle, continue de remonter telle quelle : seul l'échec de la
  // PRISE du bail devient `unavailable`.
  const run = await withLease(sql, CATALOGUE_LEASE_NAME, CATALOGUE_LEASE_TTL_MS, () =>
    runDailyMaintenance(sql, deadlineAt),
  )

  if (run.status === 'unavailable') {
    // Impossible de prouver qu'on est seul : on ne travaille pas. Refuser bruyamment vaut
    // mieux que retomber dans la concurrence que ce garde existe pour empêcher — et une
    // tâche quotidienne sautée est visible, contrairement à quatre cycles qui se marchent
    // dessus. Le cas attendu ici est la migration cron_locks non appliquée.
    return Response.json(
      { ok: false, skipped: 'lock_unavailable', error: run.error, elapsed_ms: Date.now() - startedAt },
      { status: 503 },
    )
  }

  if (run.status === 'busy') {
    // Résultat normal, pas un échec : le cycle du jour est déjà en cours ailleurs. HTTP 200
    // délibérément — marquer le cron en échec ici apprendrait à l'opérateur à ignorer ses
    // propres alertes. Le détenteur est rendu pour qu'on voie depuis quand il travaille.
    return Response.json({
      ok: true,
      skipped: 'already_running',
      lock: run.lock,
      elapsed_ms: Date.now() - startedAt,
    })
  }

  return Response.json({
    ...run.result,
    lease: { holder: run.holder, expires_at: run.expiresAt, released: run.release.released },
    elapsed_ms: Date.now() - startedAt,
  })
}

/** Le travail lui-même, inchangé : il ne s'exécute que sous bail. */
async function runDailyMaintenance(sql: Sql, deadlineAt: number) {
  const [{ total }] = await sql`select count(*)::int as total from agents`

  const changed = await sql`
    select handle from agents where updated_at > now() - interval '25 hours' order by handle limit 10000
  `
  let indexnow: unknown = { submitted: 0, batches: 0 }
  if (changed.length > 0) {
    try {
      indexnow = await submitIndexNow(
        changed.map((r) => `https://${HOST}/agents/${encodeHandle(r.handle)}`),
        () => {},
        { deadlineAt: Math.min(Date.now() + INDEXNOW_BUDGET_MS, deadlineAt) },
      )
    } catch (e) {
      indexnow = { error: e instanceof Error ? e.message : 'failed' }
    }
  }

  let purged = 0
  try {
    const res = await sql`delete from crawler_hits where created_at < now() - interval '60 days'`
    purged = res.count
  } catch {
    /* table pas encore créée : non bloquant */
  }

  const endpoints = await probeEndpoints(sql, deadlineAt)

  return {
    ok: true,
    agents: total,
    changed_urls: changed.length,
    indexnow,
    purged,
    endpoints,
  }
}

// Sonde de fraîcheur des endpoints — promesse publique du premier dossier (2026-07-25) :
// ne plus publier une adresse sans dire si elle répond, ni même si on a regardé.
// Rotation : les fiches jamais vérifiées d'abord, puis les vérifications les plus vieilles.
// Chaque endpoint silencieux coûte une seconde chance patiente (voir lib/endpoint-probe),
// donc le lot reste modeste et la concurrence élevée — c'est de l'attente réseau, pas du
// CPU. Le rattrapage de masse se fait hors ligne via scripts/probe-endpoints.mts.
// La concurrence reste à 125 délibérément. Un premier jet à 40 requêtes parallèles et 3 s
// avait fait passer pour muets 1 196 hôtes sur 8 648 : c'est notre propre liaison qui
// saturait. Monter la concurrence pour gagner du débit rachèterait ce défaut, et un faux
// silence est la pire erreur possible ici — il accuse publiquement l'agent d'un tiers.
const PROBE_BATCH = 250
const PROBE_CONCURRENCY = 125

type ProbeTarget = {
  id: string
  endpoint: string
  check: EndpointCheck | null
  cohort: CohortMember | null
}

/**
 * Une seule passe réseau pour deux besoins distincts.
 *
 * La rotation générale met environ trois semaines à faire le tour du catalogue : une
 * cohorte de quelques dizaines de sujets n'y passerait presque jamais, et une histoire
 * trouée n'est pas une histoire. Ces sujets sont donc placés EN TÊTE de la même vague
 * plutôt que sondés séparément — un second passage doublerait le temps réseau du cron et
 * réduirait d'autant la rotation du catalogue, pour la même information.
 */
async function probeEndpoints(sql: Sql, deadlineAt: number) {
  const startedAt = Date.now()
  // Le temps restant vient de l'échéance de la REQUÊTE, pas d'un compteur local : c'est
  // toute la correction. Une étape qui ne compte que son propre temps ne peut pas tenir
  // une promesse sur la durée totale.
  const remaining = () => deadlineAt - Date.now()
  try {
    // Cohorte d'abord, et de façon absorbante : tant que la migration du journal de
    // preuves n'est pas appliquée, `cohort` vaut null et le cron se comporte exactement
    // comme avant. Un vrai incident est distingué d'une migration manquante — sinon on
    // finirait par lire « not_migrated » pendant des semaines sur une table qui existe.
    let cohort: CohortMember[] | null = null
    let cohortStatus: 'ready' | 'not_migrated' | 'error' = 'ready'
    try {
      cohort = await loadActiveCohort(sql)
      if (cohort === null) cohortStatus = 'not_migrated'
    } catch {
      // Le journal de preuves ne doit jamais casser la sonde publique.
      cohortStatus = 'error'
    }

    // Priorité aux échecs pas encore confirmés : c'est là que l'information est chaude, et
    // un agent silencieux ne doit pas attendre un cycle complet pour être confirmé ou
    // réhabilité. Ensuite les fiches jamais vérifiées, puis la rotation par ancienneté.
    const candidates = await sql`
      select id, endpoint, metadata->'endpoint_check' as endpoint_check
      from agents
      where endpoint ilike 'http%'
      order by
        case
          when metadata->'endpoint_check'->>'responded' = 'false'
           and coalesce((metadata->'endpoint_check'->>'consecutive_failures')::int, 0) < ${UNREACHABLE_AFTER} then 0
          when metadata->'endpoint_check' is null then 1
          else 2
        end,
        (metadata->'endpoint_check'->>'checked_at') asc nulls first
      limit ${PROBE_BATCH}
    `

    const targets = new Map<string, ProbeTarget>()
    for (const member of cohort ?? []) {
      if (!isProbeableEndpoint(member.endpoint)) continue
      targets.set(member.agentId, {
        id: member.agentId,
        endpoint: member.endpoint,
        check: member.endpointCheck,
        cohort: member,
      })
    }
    for (const row of candidates) {
      const id = row.id as string
      if (targets.has(id)) continue
      const endpoint = row.endpoint as string
      if (!isProbeableEndpoint(endpoint)) continue
      targets.set(id, { id, endpoint, check: row.endpoint_check as EndpointCheck | null, cohort: null })
    }

    const ordered = [...targets.values()]
    const now = new Date().toISOString()
    const results: { target: ProbeTarget; check: EndpointCheck }[] = []

    let deferred = 0
    for (let i = 0; i < ordered.length; i += PROBE_CONCURRENCY) {
      // La vague ne démarre que si sa pire durée ET l'écriture finale tiennent encore.
      // Ce qui ne rentre pas est reporté et compté, pas abandonné en silence.
      if (!canStartWave(remaining())) {
        deferred = ordered.length - i
        break
      }
      const wave = ordered.slice(i, i + PROBE_CONCURRENCY)
      // Réseau en parallèle (de l'attente, pas du CPU) ; les écritures DB restent
      // séquentielles et groupées, conformément à la règle du pooler.
      const outcomes = await Promise.all(wave.map((target) => probeWithSecondChance(target.endpoint)))
      wave.forEach((target, j) => {
        results.push({ target, check: nextCheck(target.check, outcomes[j], now) })
      })
    }

    // L'état courant reste la source de « quand a-t-on regardé » : il est écrit à chaque
    // passage, y compris quand rien ne change et que le journal n'écrit rien.
    if (results.length > 0) await writeEndpointChecks(sql, results.map((r) => ({ id: r.target.id, check: r.check })))

    const history = await recordCohortAvailability(sql, results, now, cohortStatus)
    const unreachable = results.filter((r) => !r.check.responded).length
    return {
      probed: results.length,
      cohort_probed: results.filter((r) => r.target.cohort !== null).length,
      // Reporté au prochain passage faute de temps : la rotation le reprendra, mais un
      // opérateur doit pouvoir le lire plutôt que le déduire d'un compteur en baisse.
      deferred_to_next_run: deferred,
      unreachable,
      history,
      elapsed_ms: Date.now() - startedAt,
      finalize_reserve_ms: FINALIZE_RESERVE_MS,
    }
  } catch (e) {
    // Une sonde qui casse ne doit jamais casser le keep-alive ni l'indexation.
    return { error: e instanceof Error ? e.message : 'probe failed' }
  }
}

/** Écriture groupée : une seule instruction, pooler en transaction. */
async function writeEndpointChecks(sql: Sql, results: { id: string; check: EndpointCheck }[]) {
  await sql`
    update agents a
    set metadata = a.metadata || jsonb_build_object('endpoint_check', v.check::jsonb)
    from (
      select unnest(${results.map((r) => r.id)}::uuid[]) as id,
             unnest(${results.map((r) => JSON.stringify(r.check))}::text[]) as check
    ) v
    where a.id = v.id
  `
}

/**
 * Historisation bornée : seulement les sujets de la cohorte, et seulement quand la
 * disponibilité normalisée a changé. Une sonde identique produit la même empreinte et
 * n'écrit rien — c'est ce qui empêche ce journal de devenir une photographie quotidienne.
 */
async function recordCohortAvailability(
  sql: Sql,
  results: readonly { target: ProbeTarget; check: EndpointCheck }[],
  observedAt: string,
  cohortStatus: 'ready' | 'not_migrated' | 'error',
) {
  if (cohortStatus !== 'ready') return { skipped: cohortStatus }
  const inputs: ObservationInput[] = []
  for (const { target, check } of results) {
    if (!target.cohort) continue
    inputs.push({
      subjectKind: target.cohort.subjectKind,
      subjectAgentId: target.cohort.agentId,
      subjectKey: target.cohort.handle,
      source: 'endpoint-probe',
      sourceUrl: target.endpoint,
      observedAt,
      effectiveAt: null,
      facts: availabilityFacts(check),
      // Nous produisons cette observation nous-mêmes sur une adresse publique : le constat
      // peut être montré. Ce qui reste payant, c'est la chronologie et les alertes.
      visibility: 'public_summary',
      collector: 'cron:daily',
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
    })
  }
  if (inputs.length === 0) return { considered: 0, written: 0 }
  try {
    const appended = await appendObservations(sql, inputs)
    return appended
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 200) : 'append failed' }
  }
}
