import postgres from 'postgres'
const sql = postgres({ host: 'aws-0-eu-west-1.pooler.supabase.com', port: 6543, database: 'postgres', username: 'postgres.rprhlzipryatzaefrzhd', password: process.env.AGHUB_DB_PASSWORD, ssl: 'require', max: 1, connect_timeout: 15 })
const t0 = Date.now()
try {
  const [c] = await sql`
    select
      (select count(*) from agents where external_source is null)     as agents_natifs,
      (select count(*) from agents where external_source is not null) as agents_importes,
      (select count(*) from ratings)                                  as notes,
      (select count(*) from activity_log)                             as appels_total,
      (select count(*) from activity_log where created_at > now() - interval '24 hours') as appels_24h,
      (select count(distinct ip_hash) from activity_log
        where created_at > now() - interval '24 hours' and ip_hash is not null) as origines_24h
  `
  console.log('main query ok in', Date.now() - t0, 'ms:', JSON.stringify(c))
} catch (e) {
  console.log('main query FAILED in', Date.now() - t0, 'ms:', e.message)
}
const t1 = Date.now()
try {
  const [ch] = await sql`select count(*)::int as n from crawler_hits where created_at > now() - interval '24 hours'`
  console.log('crawler_hits 24h ok in', Date.now() - t1, 'ms:', ch.n)
} catch (e) { console.log('crawler_hits FAILED:', e.message) }
try {
  const [sz] = await sql`select pg_size_pretty(pg_database_size('postgres')) as db, (select count(*) from crawler_hits) as hits_total`
  console.log('db size:', sz.db, '| crawler_hits total:', sz.hits_total)
} catch (e) { console.log('size FAILED:', e.message) }
await sql.end()
