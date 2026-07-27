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

export const runtime = 'nodejs'
export const maxDuration = 60
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
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sql = getSql()
  const [{ total }] = await sql`select count(*)::int as total from agents`

  const changed = await sql`
    select handle from agents where updated_at > now() - interval '25 hours' order by handle limit 10000
  `
  let indexnow: unknown = { submitted: 0, batches: 0 }
  if (changed.length > 0) {
    try {
      indexnow = await submitIndexNow(changed.map((r) => `https://${HOST}/agents/${encodeHandle(r.handle)}`))
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

  const endpoints = await probeEndpoints(sql)

  return Response.json({
    ok: true,
    agents: total,
    changed_urls: changed.length,
    indexnow,
    purged,
    endpoints,
  })
}

// Sonde de fraîcheur des endpoints — promesse publique du premier dossier (2026-07-25) :
// ne plus publier une adresse sans dire si elle répond, ni même si on a regardé.
// Rotation : les fiches jamais vérifiées d'abord, puis les vérifications les plus vieilles.
// Chaque endpoint silencieux coûte une seconde chance patiente (voir lib/endpoint-probe),
// donc le lot reste modeste et la concurrence élevée — c'est de l'attente réseau, pas du
// CPU. Le rattrapage de masse se fait hors ligne via scripts/probe-endpoints.mts.
const PROBE_BATCH = 250
const PROBE_CONCURRENCY = 125
const PROBE_TIME_BUDGET_MS = 45_000

// Une vague peut dépasser son budget de la durée d'une seconde chance patiente : sans
// cette réserve, une vague lancée à 44 s finissait à 65 s et Vercel tuait la fonction en
// plein milieu — avec les sondes déjà faites mais jamais écrites.
const PROBE_WAVE_RESERVE_MS = 22_000

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
async function probeEndpoints(sql: Sql) {
  const startedAt = Date.now()
  const remaining = () => PROBE_TIME_BUDGET_MS - (Date.now() - startedAt)
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

    for (let i = 0; i < ordered.length; i += PROBE_CONCURRENCY) {
      if (remaining() < PROBE_WAVE_RESERVE_MS) break
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
      unreachable,
      history,
      elapsed_ms: Date.now() - startedAt,
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
