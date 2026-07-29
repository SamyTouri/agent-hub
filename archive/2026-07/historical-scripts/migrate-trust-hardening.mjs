// Migration "trust provenance + contribution proof" (2026-07-17).
// Idempotent. Usage: DATABASE_URL=... node scripts/migrate-trust-hardening.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

await sql.unsafe(`set statement_timeout = '120s'`)
await sql.unsafe(`set lock_timeout = '8s'`)

const steps = [
  `alter table contributions add column if not exists claim_channel text`,
  `create index if not exists ratings_native_ip_created_idx
    on ratings ((metadata->>'ip_hash'), created_at desc)
    where source = 'native'`,
  `create index if not exists ratings_native_rater_subject_created_idx
    on ratings (rater_agent_id, subject_agent_id, created_at desc)
    where source = 'native'`,
  `create index if not exists ratings_rater_idx on ratings (rater_agent_id)`,
  `create index if not exists ratings_subject_created_idx
    on ratings (subject_agent_id, created_at desc)`,
  `create index if not exists contributions_agent_idx on contributions (agent_id)`,
  `create index if not exists activity_log_tool_ip_created_idx
    on activity_log (tool, ip_hash, created_at desc)`,
  `create index if not exists feedback_ip_created_idx
    on feedback (ip_hash, created_at desc)`,
  `create index if not exists agent_requests_ip_created_idx
    on agent_requests (ip_hash, created_at desc)`,
  `create index if not exists agents_directory_idx
    on agents ((external_source is not null), updated_at desc)`,
  `alter function public.match_agents(vector, double precision, integer)
    set search_path = public, pg_temp`,
  `alter function public.set_updated_at() set search_path = public, pg_temp`,
  `revoke execute on function public.rls_auto_enable() from public, anon, authenticated`,
  `drop view if exists agent_reputation`,
  `create view agent_reputation with (security_invoker = true) as
    select
      a.id as agent_id,
      a.handle,
      count(r.*) filter (
        where r.source <> 'native'
           or r.metadata->>'rater_verified' = 'true'
      ) as total_ratings,
      count(r.*) filter (
        where r.source = 'native'
          and r.metadata->>'rater_verified' = 'true'
      ) as native_ratings,
      count(r.*) filter (
        where r.source = 'native'
          and r.metadata->>'rater_verified' = 'true'
      ) as verified_native_ratings,
      count(r.*) filter (
        where r.source = 'native'
          and r.metadata->>'rater_verified' is distinct from 'true'
      ) as anonymous_native_ratings,
      count(r.*) filter (where r.source <> 'native') as imported_ratings,
      round(avg(r.score) filter (
        where r.source = 'native'
          and r.metadata->>'rater_verified' = 'true'
      ), 2) as native_avg_score,
      round(avg(r.score) filter (
        where r.source = 'native'
          and r.metadata->>'rater_verified' = 'true'
      ), 2) as verified_native_avg_score,
      round(avg(r.score) filter (
        where r.source = 'native'
          and r.metadata->>'rater_verified' is distinct from 'true'
      ), 2) as anonymous_native_avg_score,
      round(avg(r.score) filter (where r.source <> 'native'), 2) as imported_avg_score
    from agents a
    left join ratings r on r.subject_agent_id = a.id
    group by a.id, a.handle`,
]

for (const step of steps) {
  let done = false
  for (let attempt = 1; attempt <= 6 && !done; attempt++) {
    try {
      await sql.unsafe(step)
      done = true
      console.error(`ok: ${step.slice(0, 80).replace(/\s+/g, ' ')}`)
    } catch (error) {
      console.error(`attempt ${attempt} failed (${error.code ?? error.message}) — retrying in 5s`)
      if (attempt === 6) throw error
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

await sql`
  update contributions
  set claim_channel = 'moltbook:' || credited_handle
  where receipt_id in ('FC-0001', 'FC-0002', 'FC-0003')
`
await sql`
  update contributions c
  set agent_id = null
  from agents a
  where c.agent_id = a.id and a.status = 'listed'
`

const [check] = await sql`
  select
    (select count(*)::int from contributions where claim_channel is not null) as protected_receipts,
    (select count(*)::int from contributions where agent_id is not null) as attached_receipts
`
console.error(JSON.stringify(check))
await sql.end()
