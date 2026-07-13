import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
const [r] = await sql`
  select
    pg_size_pretty(pg_database_size(current_database())) as db_size,
    (select count(*) from agents) as agents_total,
    (select count(*) from agents where external_source = 'mcp-registry') as imported,
    (select count(*) from ratings) as ratings
`
console.log(JSON.stringify(r))
await sql.end({ timeout: 5 })
