// Exécute un fichier .sql (migrations multi-instructions, blocs DO, transactions).
// Usage : node scripts/run-sql-file.mjs db/migration-xxx.sql   (DATABASE_URL requis)
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('Usage: node scripts/run-sql-file.mjs <file.sql>')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
try {
  const result = await sql.unsafe(readFileSync(path, 'utf8'))
  const sets = Array.isArray(result) ? result : [result]
  console.log(`OK ${path} (${sets.length} statement result set(s))`)
} finally {
  await sql.end()
}
