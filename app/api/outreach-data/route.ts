import { getSql, withTimeout } from '@/lib/db'
import { registerAgent } from '@/lib/agenthub'
import {
  completeRepresentativeOutboundSend,
  reconcileRepresentativeOutboundSend,
  reopenRepresentativeOutboundApproval,
  reserveRepresentativeOutboundSend,
  reviseRepresentativeOutboundDraft,
  updateRepresentativeOutbound,
} from '@/lib/representative'
import {
  representativeOutboundRecordVersion,
  RepresentativeOutboundError,
} from '@/lib/representative-outbound'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
    const contactRequests = await withTimeout(sql`
      select
        cr.request_ref,
        requester.handle as requester_handle,
        recipient.handle as recipient_handle,
        cr.purpose,
        case
          when cr.status = 'pending' and cr.expires_at <= now() then 'expired'
          else cr.status
        end as status,
        cr.created_at,
        cr.responded_at
      from contact_requests cr
      join agents requester on requester.id = cr.requester_agent_id
      join agents recipient on recipient.id = cr.recipient_agent_id
      where cr.created_at > now() - interval '72 hours'
      order by cr.created_at desc
      limit 50
    `)
    const unclaimedReceipts = await withTimeout(sql`
      select receipt_id, credited_handle, contribution_type, status
      from contributions
      where agent_id is null
      order by seq
    `)
    const representativeSettings = await withTimeout(sql`
      select key, value, updated_at
      from rep_settings
      where key in ('enabled', 'mode', 'daily_usd_cap', 'outbound_per_day', 'openai_identity')
      order by key
    `)
    const representativeUsage = await withTimeout(sql`
      select
        coalesce(sum(usd), 0)::float as usd_today,
        coalesce(sum(input_tokens), 0)::int as input_tokens_today,
        coalesce(sum(output_tokens), 0)::int as output_tokens_today,
        count(*) filter (where purpose not like '%:reserved')::int as completed_calls_today
      from rep_llm_usage
      where created_at >= date_trunc('day', now())
    `)
    const representativeRuns = await withTimeout(sql`
      select status, mode, actions_count, llm_calls, openai_identity_match,
             summary, error, started_at, finished_at
      from rep_runs
      order by started_at desc
      limit 20
    `)
    const representativeDrafts = await withTimeout(sql`
      select id, target_identity, channel, target_url, reason, draft, status,
             metadata, next_action_at, last_checked_at, response_summary,
             external_id, sent_at, created_at, updated_at, xmin::text as record_xmin
      from rep_outbound
      where status in ('qualified', 'draft', 'approved', 'sent', 'replied', 'failed')
      order by
        case status
          when 'replied' then 0
          when 'draft' then 1
          when 'approved' then 2
          when 'qualified' then 3
          when 'failed' then 4
          else 5
        end,
        updated_at desc
      limit 100
    `)
    const representativeFunnel = await withTimeout(sql`
      select status, channel, count(*)::int as count
      from rep_outbound
      group by status, channel
      order by channel, status
    `)
    const representativeConversations = await withTimeout(sql`
      select channel, stage, count(*)::int as count, max(last_activity_at) as last_activity_at
      from rep_conversations
      group by channel, stage
      order by channel, stage
    `)
    const representativeEscalations = await withTimeout(sql`
      select category, summary, status, created_at
      from rep_escalations
      where status = 'open'
      order by created_at desc
      limit 20
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
      contact_requests_72h: contactRequests,
      unclaimed_contribution_receipts: unclaimedReceipts,
      representative: {
        settings: representativeSettings,
        usage_today: representativeUsage[0],
        recent_runs: representativeRuns,
        campaign_queue: representativeDrafts.map((row) => {
          const { record_xmin: _recordXmin, ...outbound } = row
          return {
            ...outbound,
            record_version: representativeOutboundRecordVersion(row),
          }
        }),
        campaign_funnel: representativeFunnel,
        conversations: representativeConversations,
        open_escalations: representativeEscalations,
      },
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}

// Actions authentifiées de la routine : revue atomique des drafts du représentant,
// suivi du ledger d'envoi, et inscription Moltbook contextuelle. Cette dernière reste
// strictement volontaire : l'auteur a répondu "claim" / "register me" dans un fil.
// La fiche est claimed par canal prouvé (metadata.claim_channel), PAS par token.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 })
    }
    const action =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).action
        : null
    if (action === 'revise_representative_outbound') {
      const parsed = z
        .object({
          action: z.literal('revise_representative_outbound'),
          id: z.string(),
          draft: z.string(),
          reviewer: z.string(),
          note: z.string(),
          expected_version: z.string(),
        })
        .strict()
        .safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: 'invalid draft revision payload' }, { status: 400 })
      }
      const result = await reviseRepresentativeOutboundDraft({
        id: parsed.data.id,
        draft: parsed.data.draft,
        reviewer: parsed.data.reviewer,
        note: parsed.data.note,
        expectedVersion: parsed.data.expected_version,
      })
      return Response.json({ ok: true, outbound: result })
    }
    if (action === 'reopen_representative_outbound_approval') {
      const parsed = z
        .object({
          action: z.literal('reopen_representative_outbound_approval'),
          id: z.string(),
          reviewer: z.string(),
          note: z.string(),
          expected_version: z.string(),
        })
        .strict()
        .safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: 'invalid approval reopen payload' }, { status: 400 })
      }
      const result = await reopenRepresentativeOutboundApproval({
        id: parsed.data.id,
        reviewer: parsed.data.reviewer,
        note: parsed.data.note,
        expectedVersion: parsed.data.expected_version,
      })
      return Response.json({ ok: true, outbound: result })
    }
    if (action === 'reserve_representative_outbound_send') {
      const parsed = z
        .object({
          action: z.literal('reserve_representative_outbound_send'),
          id: z.string(),
          expected_version: z.string(),
          send_attempt_id: z.string(),
          review_run_id: z.string(),
          reviewer: z.string(),
          github_actor: z.string(),
        })
        .strict()
        .safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: 'invalid outbound send reservation payload' }, { status: 400 })
      }
      const result = await reserveRepresentativeOutboundSend({
        id: parsed.data.id,
        expectedVersion: parsed.data.expected_version,
        sendAttemptId: parsed.data.send_attempt_id,
        reviewRunId: parsed.data.review_run_id,
        reviewer: parsed.data.reviewer,
        githubActor: parsed.data.github_actor,
      })
      return Response.json({ ok: true, ...result })
    }
    if (action === 'complete_representative_outbound_send') {
      const parsed = z
        .object({
          action: z.literal('complete_representative_outbound_send'),
          id: z.string(),
          send_attempt_id: z.string(),
          target_url: z.string().optional(),
        })
        .strict()
        .safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: 'invalid outbound send completion payload' }, { status: 400 })
      }
      const result = await completeRepresentativeOutboundSend({
        id: parsed.data.id,
        sendAttemptId: parsed.data.send_attempt_id,
        targetUrl: parsed.data.target_url,
      })
      return Response.json({ ok: true, outbound: result })
    }
    if (action === 'reconcile_representative_outbound_send') {
      const parsed = z
        .object({
          action: z.literal('reconcile_representative_outbound_send'),
          id: z.string(),
          send_attempt_id: z.string(),
          reviewer: z.string(),
          note: z.string(),
        })
        .strict()
        .safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: 'invalid outbound send reconciliation payload' }, { status: 400 })
      }
      const result = await reconcileRepresentativeOutboundSend({
        id: parsed.data.id,
        sendAttemptId: parsed.data.send_attempt_id,
        reviewer: parsed.data.reviewer,
        note: parsed.data.note,
      })
      return Response.json({ ok: true, ...result })
    }
    if (action === 'update_representative_outbound') {
      const parsed = z
        .object({
          action: z.literal('update_representative_outbound'),
          id: z.string(),
          status: z.enum([
            'approved',
            'sent',
            'replied',
            'converted',
            'declined',
            'suppressed',
            'failed',
          ]),
          target_url: z.string().optional(),
          external_id: z.string().optional(),
          note: z.string().optional(),
          reviewer: z.string().optional(),
          draft: z.string().optional(),
          expected_version: z.string(),
        })
        .strict()
        .safeParse(body)
      if (!parsed.success) {
        return Response.json({ error: 'invalid outbound update payload' }, { status: 400 })
      }
      const result = await updateRepresentativeOutbound({
        id: parsed.data.id,
        status: parsed.data.status,
        targetUrl: parsed.data.target_url,
        externalId: parsed.data.external_id,
        note: parsed.data.note,
        reviewer: parsed.data.reviewer,
        draft: parsed.data.draft,
        expectedVersion: parsed.data.expected_version,
      })
      return Response.json({ ok: true, outbound: result })
    }
    if (action !== 'register_from_moltbook') {
      return Response.json(
        {
          error:
            'unknown outreach-data action',
        },
        { status: 400 },
      )
    }
    const registration = z
      .object({
        action: z.literal('register_from_moltbook'),
        handle: z.string().trim().min(1),
        description: z.string().trim().min(1),
        tags: z.array(z.string()).nullable().optional(),
        endpoint: z.string().nullable().optional(),
        protocols: z.array(z.string()).nullable().optional(),
        moltbook_author: z.string().trim().min(1),
        permalink: z.string().nullable().optional(),
      })
      .passthrough()
      .safeParse(body)
    if (!registration.success) {
      return Response.json(
        { error: 'handle, description and moltbook_author are required' },
        { status: 400 },
      )
    }
    const {
      handle,
      description,
      tags,
      endpoint,
      protocols,
      moltbook_author,
      permalink,
    } = registration.data
    if (
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
      tags: tags ?? undefined,
      endpoint: endpoint ?? undefined,
      protocols: protocols ?? undefined,
      claimChannel: `moltbook:${moltbook_author.trim()}`,
      claimPermalink: permalink ?? undefined,
    })
    return Response.json(result)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: e instanceof RepresentativeOutboundError ? e.status : 500 },
    )
  }
}
