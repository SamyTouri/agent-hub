// Amorçage / rattrapage de la sonde d'endpoints, en local et sans limite de durée.
// Le cron quotidien ne traite que 400 fiches par passage (60 s max sur Vercel), soit un
// cycle de trois semaines. Ce script fait le tour complet en une fois — utile au premier
// amorçage et après un incident. Même logique et mêmes seuils que le cron : la vérité
// publiée ne dépend pas de qui a lancé la sonde.
//
// Usage : node --experimental-strip-types scripts/probe-endpoints.mts [limit]
// DATABASE_URL requis (pooler).
import postgres from 'postgres'
import { isProbeableEndpoint, nextCheck, probeEndpoint, type EndpointCheck } from '../lib/endpoint-probe.ts'

const LIMIT = Number(process.argv[2] ?? 20000)
const CONCURRENCY = 40

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require', max: 1 })
try {
  const rows = await sql`
    select id, handle, endpoint, metadata->'endpoint_check' as endpoint_check
    from agents
    where endpoint ilike 'http%'
    order by (metadata->'endpoint_check'->>'checked_at') asc nulls first
    limit ${LIMIT}
  `
  const targets = rows.filter((r) => isProbeableEndpoint(r.endpoint as string))
  console.error(`PROBE: ${targets.length} probeable endpoints (of ${rows.length} selected)`)

  const now = new Date().toISOString()
  const results: { id: string; handle: string; check: EndpointCheck }[] = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const wave = targets.slice(i, i + CONCURRENCY)
    const outcomes = await Promise.all(wave.map((r) => probeEndpoint(r.endpoint as string)))
    wave.forEach((r, j) => {
      results.push({
        id: r.id as string,
        handle: r.handle as string,
        check: nextCheck(r.endpoint_check as EndpointCheck | null, outcomes[j], now),
      })
    })
    if ((i / CONCURRENCY) % 10 === 0) console.error(`... probed ${results.length}/${targets.length}`)
  }

  // Écriture groupée : une seule instruction, pooler en transaction.
  const CHUNK = 1000
  for (let i = 0; i < results.length; i += CHUNK) {
    const c = results.slice(i, i + CHUNK)
    await sql`
      update agents a
      set metadata = a.metadata || jsonb_build_object('endpoint_check', v.check::jsonb)
      from (
        select unnest(${c.map((r) => r.id)}::uuid[]) as id,
               unnest(${c.map((r) => JSON.stringify(r.check))}::text[]) as check
      ) v
      where a.id = v.id
    `
  }

  const down = results.filter((r) => !r.check.responded)
  console.error(`DONE probed=${results.length} responding=${results.length - down.length} silent=${down.length}`)
  for (const r of down.slice(0, 15)) console.error(`  silent: ${r.handle}`)
} finally {
  await sql.end()
}
