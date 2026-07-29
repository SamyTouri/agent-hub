// Import complet du catalogue du registre MCP officiel dans Agent Hub (source externe).
//
// Ancêtre de `lib/registry-sync.ts`, qui n'importe que le delta quotidien (`updated_since`).
// Ce script-ci repart de zéro : c'est le seul chemin capable de reconstruire le catalogue de
// compatibilité après une base neuve ou un trou d'importation. Le catalogue n'est plus une
// douve (docs/DOCTRINE.md) mais il reste une surface de distribution et un engagement public,
// donc la capacité de le reconstruire est conservée.
//
// 2026-07-29 — n'écrit plus d'embedding et n'appelle plus OpenAI. La recherche est lexicale
// (`lib/text-match.ts` + index plein texte) ; le seul travail restant ici est de recopier
// fidèlement ce que le registre publie.
//
// Env requis : DATABASE_URL (pooler). Optionnel : LIMIT.
import postgres from 'postgres'

const { DATABASE_URL } = process.env
if (!DATABASE_URL) { console.error('MISSING_ENV DATABASE_URL'); process.exit(1) }
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity

// max:1 — le pooler transactionnel Supabase (PgBouncer) fait pipeliner les requêtes
// concurrentes jusqu'au timeout. Une seule connexion, des écritures séquentielles.
const sql = postgres(DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

const base = 'https://registry.modelcontextprotocol.io/v0.1/servers'
const byName = new Map()
let cursor = null, pages = 0
while (byName.size < LIMIT) {
  const url = new URL(base)
  url.searchParams.set('limit', '100')
  if (cursor) url.searchParams.set('cursor', cursor)
  const res = await fetch(url)
  if (!res.ok) { console.error('FETCH_FAIL', res.status); break }
  const data = await res.json()
  for (const item of data.servers ?? []) {
    const s = item.server
    const meta = item._meta?.['io.modelcontextprotocol.registry/official']
    if (meta?.isLatest === false) continue
    if (meta?.status && meta.status !== 'active') continue
    if (s?.name && !byName.has(s.name)) byName.set(s.name, s)
    if (byName.size >= LIMIT) break
  }
  cursor = data.metadata?.nextCursor
  pages++
  if (!cursor) break
}
const servers = [...byName.values()]
console.log(`FETCHED ${servers.length} serveurs (latest, actifs) en ${pages} pages`)

const PROGRESS_EVERY = 100
let done = 0
for (let i = 0; i < servers.length; i++) {
  const s = servers[i]
  const endpoint = s.remotes?.[0]?.url ?? null
  try {
    await sql`
      insert into agents (handle, display_name, description, endpoint, protocols, external_source, external_id)
      values (${s.name}, ${s.title ?? null}, ${s.description ?? s.name}, ${endpoint}, ${['mcp']}, 'mcp-registry', ${s.name})
      on conflict (external_source, external_id) do update set
        description = excluded.description, endpoint = excluded.endpoint, updated_at = now()
    `
    done++
  } catch (e) { console.error('SKIP', s.name, (e.message ?? '').slice(0, 80)) }
  if ((i + 1) % PROGRESS_EVERY === 0) console.log(`... ${i + 1}/${servers.length}`)
}
const [{ count }] = await sql`select count(*) from agents where external_source = 'mcp-registry'`
console.log(`DONE inserted/updated=${done} total_mcp_registry=${count}`)
await sql.end({ timeout: 5 })
