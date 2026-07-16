import postgres from 'postgres'
const sql = postgres({ host: 'aws-0-eu-west-1.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.rprhlzipryatzaefrzhd', password: process.env.AGHUB_DB_PASSWORD, ssl: 'require', max: 1, connect_timeout: 15 })
const rows = await sql`
  select ip_hash, count(*)::int as n,
         array_agg(distinct left(user_agent, 60)) as uas,
         min(created_at) as first_seen, max(created_at) as last_seen
  from activity_log where ip_hash is not null
  group by ip_hash order by max(created_at) desc
`
for (const r of rows) console.log(JSON.stringify(r))
await sql.end()
