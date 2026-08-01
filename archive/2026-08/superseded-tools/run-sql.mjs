// Exécute du SQL arbitraire sur la DB (DDL/migrations one-shot).
// Usage : node scripts/run-sql.mjs "alter table ..." (DATABASE_URL requis, pooler session 5432 pour le DDL)
import postgres from 'postgres'

const stmt = process.argv[2]
if (!stmt) {
  console.error('Usage: node scripts/run-sql.mjs "<sql>"')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
try {
  const result = await sql.unsafe(stmt)
  console.log('OK', Array.isArray(result) ? `(${result.length} rows)` : '')
  if (Array.isArray(result) && result.length > 0) console.log(JSON.stringify(result.slice(0, 50), null, 2))
} finally {
  await sql.end()
}
