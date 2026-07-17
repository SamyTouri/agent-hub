import { getSql, withTimeout } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Route de diagnostic temporaire : exécute une à une les requêtes du dashboard
// avec timing et erreur détaillée. Protégée par CRON_SECRET. À SUPPRIMER après.
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const out: Record<string, unknown> = {}
  const run = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now()
    try {
      const r = await fn()
      out[name] = { ok: true, ms: Date.now() - t, sample: JSON.stringify(r).slice(0, 120) }
    } catch (e) {
      out[name] = { ok: false, ms: Date.now() - t, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
    }
  }
  const sql = getSql()
  await run('main', async () => (await withTimeout(sql`
    select
      (select count(*) from agents where external_source is null)     as agents_natifs,
      (select count(*) from agents where external_source is not null) as agents_importes,
      (select count(*) from ratings)                                  as notes,
      (select count(*) from activity_log)                             as appels_total,
      (select count(*) from activity_log where created_at > now() - interval '24 hours') as appels_24h,
      (select count(distinct ip_hash) from activity_log
        where created_at > now() - interval '24 hours' and ip_hash is not null) as origines_24h
  `))[0])
  await run('crawlers', async () => (await withTimeout(sql`select count(*)::int as n from crawler_hits where created_at > now() - interval '24 hours'`))[0])
  await run('parBot', () => withTimeout(sql`
    select bot, count(*)::int as n, max(created_at) as last_seen
    from crawler_hits where created_at > now() - interval '7 days'
    group by bot order by n desc limit 15
  `))
  await run('parTool', () => withTimeout(sql`select tool, count(*)::int as n from activity_log group by tool order by n desc`))
  await run('recents', () => withTimeout(sql`
    select tool, summary, left(ip_hash, 6) as origin, left(user_agent, 80) as ua, created_at
    from activity_log order by created_at desc limit 25
  `))
  await run('origins', () => withTimeout(sql`
    select left(ip_hash, 6) as origin, count(*)::int as n,
           min(created_at) as first_seen,
           max(created_at) as last_seen,
           left((array_agg(user_agent order by created_at desc))[1], 80) as ua
    from activity_log
    where created_at > now() - interval '7 days' and ip_hash is not null
    group by 1 order by max(created_at) desc limit 12
  `))
  await run('feedbacks', () => withTimeout(sql`
    select category, message, looking_for, found_it, agent_handle, left(ip_hash, 6) as origin, created_at
    from feedback order by created_at desc limit 20
  `))
  await run('feedbackCount', async () => (await withTimeout(sql`select count(*)::int as n from feedback`))[0])
  out.env = { hasDbUrl: !!process.env.DATABASE_URL, excludedSet: !!process.env.EXCLUDED_IP_HASHES }
  return Response.json(out)
}
