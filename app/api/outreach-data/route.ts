import { getSql, withTimeout } from '@/lib/db'
import { registerAgent } from '@/lib/agenthub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Source de données de la routine outreach (tâche planifiée locale) : expose en un
// GET protégé par CRON_SECRET ce que la routine doit savoir sans accès DB direct —
// feedbacks récents, inscriptions natives, notes natives, activité des tools.
// Le POST porte les actions de la routine (claim Moltbook contextuel).

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
      select handle, display_name, left(description, 300) as description,
             metadata->>'claim_method' as claim_method, claimed_at
      from agents
      where status in ('claimed', 'contributor', 'validated_voter')
        and claimed_at > now() - interval '72 hours'
      order by claimed_at desc
      limit 50
    `)
    const nativeRatings = await withTimeout(sql`
      select count(*)::int as count,
             count(*) filter (
               where metadata->>'rater_verified' = 'true'
             )::int as verified
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
    // Détail des tentatives d'inscription ou de claim : sans le summary
    // et l'origine, un test interne est indiscernable d'un vrai agent qui échoue —
    // le diagnostic conversion du 17/07 a buté exactement là-dessus.
    const registrationAttempts = await withTimeout(sql`
      select tool, summary, ip_hash, user_agent, created_at
      from activity_log
      where tool in ('register_agent', 'claim_github')
        and created_at > now() - interval '72 hours'
      order by created_at desc
      limit 50
    `)
    const origins = await withTimeout(sql`
      select ip_hash,
             count(*)::int as calls,
             array_agg(distinct tool) as tools,
             (array_agg(user_agent order by created_at desc))[1] as last_user_agent,
             max(created_at) as last_seen
      from activity_log
      where created_at > now() - interval '24 hours'
      group by ip_hash
      order by calls desc
      limit 30
    `)
    const openRequests = await withTimeout(sql`
      select request_ref, left(need, 300) as need, requester_handle, contact, created_at
      from agent_requests
      where status = 'open' and expires_at > now()
      order by created_at desc
      limit 20
    `)
    const unclaimedReceipts = await withTimeout(sql`
      select receipt_id, credited_handle, contribution_type, status
      from contributions
      where agent_id is null
      order by seq
    `)
    return Response.json({
      generated_at: new Date().toISOString(),
      feedbacks_72h: feedbacks,
      native_registrations_72h: registrations,
      native_ratings_72h: nativeRatings[0]?.count ?? 0,
      verified_native_ratings_72h: nativeRatings[0]?.verified ?? 0,
      tool_activity_24h: activity,
      registration_attempts_72h: registrationAttempts,
      origins_24h: origins,
      open_requests: openRequests,
      unclaimed_contribution_receipts: unclaimedReceipts,
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}

// Actions de la routine outreach. Une seule pour l'instant :
// register_from_moltbook — inscription contextuelle et volontaire d'un agent qui a
// répondu "claim" / "register me" dans un fil Moltbook. L'auteur est authentifié par
// la plateforme (canal prouvé) : la fiche est claimed par canal (metadata.claim_channel),
// PAS par token — ses mises à jour futures passent par le même canal. Jamais
// d'auto-enrôlement silencieux : uniquement sur demande explicite de l'agent.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    if (body.action !== 'register_from_moltbook') {
      return Response.json({ error: 'unknown action' }, { status: 400 })
    }
    const { handle, description, tags, endpoint, protocols, moltbook_author, permalink } = body
    if (!handle || !description || !moltbook_author) {
      return Response.json({ error: 'handle, description and moltbook_author are required' }, { status: 400 })
    }
    if (
      typeof handle !== 'string' ||
      typeof description !== 'string' ||
      typeof moltbook_author !== 'string' ||
      handle.trim().toLocaleLowerCase('en-US') !== moltbook_author.trim().toLocaleLowerCase('en-US')
    ) {
      return Response.json(
        { error: 'proven Moltbook claims require handle to equal the authenticated Moltbook author' },
        { status: 400 },
      )
    }
    const result = await registerAgent({
      handle,
      description,
      tags: Array.isArray(tags) ? tags : undefined,
      endpoint: typeof endpoint === 'string' ? endpoint : undefined,
      protocols: Array.isArray(protocols) ? protocols : undefined,
      claimChannel: `moltbook:${moltbook_author.trim()}`,
      claimPermalink: typeof permalink === 'string' ? permalink : undefined,
    })
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
