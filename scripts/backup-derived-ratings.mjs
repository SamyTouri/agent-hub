// Sauvegarde one-shot des notes dérivées avant leur suppression (migration 2026-07-25).
// Écrit .exchange/backup-github-stars-ratings.json (gitignoré). DATABASE_URL requis.
import postgres from 'postgres'
import { writeFileSync, mkdirSync } from 'node:fs'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
try {
  const rows = await sql`
    select r.id, a.handle, r.score, r.comment, r.source, r.external_id, r.metadata, r.created_at
    from ratings r
    join agents a on a.id = r.subject_agent_id
    where r.source = 'github-stars'
    order by a.handle
  `
  mkdirSync('.exchange', { recursive: true })
  writeFileSync(
    '.exchange/backup-github-stars-ratings.json',
    JSON.stringify({ exported_rows: rows.length, rows }, null, 1),
  )
  console.log(`OK ${rows.length} rows -> .exchange/backup-github-stars-ratings.json`)
} finally {
  await sql.end()
}
