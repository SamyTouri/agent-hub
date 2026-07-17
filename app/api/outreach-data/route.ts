import { getSql, withTimeout } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Source de données de la routine outreach (tâche planifiée locale) : expose en un
// GET protégé par CRON_SECRET ce que la routine doit savoir sans accès DB direct —
// feedbacks récents, inscriptions natives, notes natives, activité des tools.

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const sql = getSql()
    // Séquentiel obligatoire : sur le pooler transaction (max:1), des requêtes
    // concurrentes pipelinées à travers PgBouncer restent en attente → timeout.
    const feedbacks = await withTimeout(sql`
      select id, category, message, looking_for, found_it, agent_handle, contact, created_at
      from feedback
      where created_at > now() - interval '72 hours'
      order by created_at desc
      limit 50
    `)
    const registrations = await withTimeout(sql`
      select handle, display_name, left(description, 300) as description, created_at
      from agents
      where external_source is null and created_at > now() - interval '72 hours'
      order by created_at desc
      limit 50
    `)
    const nativeRatings = await withTimeout(sql`
      select count(*)::int as count
      from ratings
      where source = 'native' and created_at > now() - interval '72 hours'
    `)
    const activity = await withTimeout(sql`
      select tool, count(*)::int as count
      from activity_log
      where created_at > now() - interval '24 hours'
      group by tool
      order by count desc
    `)
    return Response.json({
      generated_at: new Date().toISOString(),
      feedbacks_72h: feedbacks,
      native_registrations_72h: registrations,
      native_ratings_72h: nativeRatings[0]?.count ?? 0,
      tool_activity_24h: activity,
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
