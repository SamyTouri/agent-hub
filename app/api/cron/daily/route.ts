import { getSql } from '@/lib/db'
import { submitIndexNow, HOST } from '@/lib/indexnow'
import {
  UNREACHABLE_AFTER,
  isProbeableEndpoint,
  nextCheck,
  probeWithSecondChance,
  type EndpointCheck,
} from '@/lib/endpoint-probe'

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

  const endpoints = await probeStaleEndpoints(sql)

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

async function probeStaleEndpoints(sql: ReturnType<typeof getSql>) {
  const startedAt = Date.now()
  try {
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
    const targets = candidates.filter((row) => isProbeableEndpoint(row.endpoint as string))
    const now = new Date().toISOString()
    const results: { id: string; check: EndpointCheck }[] = []

    for (let i = 0; i < targets.length; i += PROBE_CONCURRENCY) {
      if (Date.now() - startedAt > PROBE_TIME_BUDGET_MS) break
      const wave = targets.slice(i, i + PROBE_CONCURRENCY)
      // Réseau en parallèle (de l'attente, pas du CPU) ; les écritures DB restent
      // séquentielles et groupées, conformément à la règle du pooler.
      const outcomes = await Promise.all(
        wave.map((row) => probeWithSecondChance(row.endpoint as string)),
      )
      wave.forEach((row, j) => {
        results.push({
          id: row.id as string,
          check: nextCheck(row.endpoint_check as EndpointCheck | null, outcomes[j], now),
        })
      })
    }

    if (results.length > 0) {
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

    const unreachable = results.filter((r) => !r.check.responded).length
    return { probed: results.length, unreachable, elapsed_ms: Date.now() - startedAt }
  } catch (e) {
    // Une sonde qui casse ne doit jamais casser le keep-alive ni l'indexation.
    return { error: e instanceof Error ? e.message : 'probe failed' }
  }
}
